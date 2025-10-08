import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import toast from 'react-hot-toast';

export function ConnectionManager({ wallet }) {
  const [showScanner, setShowScanner] = useState(false);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const lastScannedRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  useEffect(() => {
    const storedConnections = localStorage.getItem('xrpl_connections');
    if (storedConnections) {
      try {
        setConnections(JSON.parse(storedConnections));
      } catch (error) {
        console.error('Error loading stored connections:', error);
        localStorage.removeItem('xrpl_connections');
      }
    }
  }, []);

  useEffect(() => {
    if (showScanner && !scanning) {
      setScanning(true);
      const qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true
        }
      );

      qrScanner.render(handleScan, handleError);
      scannerRef.current = qrScanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
        setScanning(false);
        lastScannedRef.current = null;
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
      }
    };
  }, [showScanner]);

  const handleScan = (decodedText) => {
    // Prevent duplicate scans within 2 seconds
    if (lastScannedRef.current === decodedText && 
        scanTimeoutRef.current) {
      return;
    }

    lastScannedRef.current = decodedText;
    
    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Set new timeout
    scanTimeoutRef.current = setTimeout(() => {
      lastScannedRef.current = null;
    }, 2000);

    try {
      // First, try to parse as JSON
      let data;
      try {
        data = JSON.parse(decodedText);
      } catch (error) {
        // If not JSON, check if it's a valid XRPL address or other format
        if (decodedText.startsWith('r') && decodedText.length >= 25 && decodedText.length <= 35) {
          // Valid XRPL address format
          data = {
            type: 'xrpl_address',
            address: decodedText
          };
        } else if (decodedText.startsWith('https://') || decodedText.startsWith('http://')) {
          // URL format
          data = {
            type: 'url',
            url: decodedText
          };
        } else {
          throw new Error('Unrecognized QR code format');
        }
      }

      // Handle different types of QR codes
      switch (data.type) {
        case 'xrpl_connect':
          if (!data.appName || !data.appId) {
            throw new Error('Invalid connection request format');
          }

          // Check if connection already exists
          const existingConnection = connections.find(conn => conn.id === data.appId);
          if (existingConnection) {
            toast.error('This app is already connected');
            return;
          }

          const newConnection = {
            id: data.appId,
            name: data.appName,
            url: data.appUrl,
            timestamp: new Date().toISOString(),
            permissions: data.permissions || ['read_balance'],
            status: 'pending'
          };

          setConnections(prev => {
            const updated = [...prev, newConnection];
            localStorage.setItem('xrpl_connections', JSON.stringify(updated));
            return updated;
          });

          setShowScanner(false);
          setSelectedConnection(newConnection);
          toast.success(`Connection request from ${data.appName}`);
          break;

        case 'xrpl_address':
          // Handle XRPL address
          navigator.clipboard.writeText(data.address);
          toast.success('XRPL address copied to clipboard');
          setShowScanner(false);
          break;

        case 'url':
          // Handle URL
          window.open(data.url, '_blank');
          toast.success('Opening URL');
          setShowScanner(false);
          break;

        default:
          throw new Error('Unsupported QR code type');
      }
    } catch (error) {
      // Only show error for actual scanning attempts
      if (decodedText && decodedText.trim()) {
        console.error('QR code error:', error);
        toast.error(error.message || 'Invalid QR code format');
      }
    }
  };

  const handleError = (error) => {
    // Only log critical errors, ignore common scanning errors
    if (!error.message.includes('No MultiFormat Readers') && 
        !error.message.includes('No barcode or QR code detected')) {
      console.error('QR Scanner error:', error);
    }
  };

  const approveConnection = (connection) => {
    setConnections(prev => {
      const updated = prev.map(conn => 
        conn.id === connection.id 
          ? { ...conn, status: 'connected' } 
          : conn
      );
      localStorage.setItem('xrpl_connections', JSON.stringify(updated));
      return updated;
    });
    toast.success(`Connected to ${connection.name}`);
    setSelectedConnection(null);
  };

  const revokeConnection = (connection) => {
    setConnections(prev => {
      const updated = prev.filter(conn => conn.id !== connection.id);
      localStorage.setItem('xrpl_connections', JSON.stringify(updated));
      return updated;
    });
    toast.success(`Disconnected from ${connection.name}`);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-700/50 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Connected Apps</h2>
        <button
          onClick={() => setShowScanner(!showScanner)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0 0h4m-4-8h4m-4 4h4m6-4v1m-4-1v1m-4-1v1m-4-1v1m2-4h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h2m4 0h2" />
          </svg>
          {showScanner ? 'Close Scanner' : 'Scan QR Code'}
        </button>
      </div>

      {showScanner && (
        <div className="mb-6">
          <div className="max-w-md mx-auto" id="qr-reader">
            <p className="text-sm text-gray-400 text-center mb-2">
              Position the QR code within the frame to scan
            </p>
          </div>
        </div>
      )}

      {selectedConnection && (
        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <h3 className="text-lg font-medium text-white mb-2">Connection Request</h3>
          <p className="mb-2"><strong>App:</strong> {selectedConnection.name}</p>
          {selectedConnection.url && (
            <p className="mb-2"><strong>URL:</strong> {selectedConnection.url}</p>
          )}
          <p className="mb-4">
            <strong>Permissions:</strong>{' '}
            {selectedConnection.permissions.join(', ')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => approveConnection(selectedConnection)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => setSelectedConnection(null)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {connections.length > 0 ? (
          connections.map((connection) => (
            <div
              key={connection.id}
              className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-white">{connection.name}</h3>
                  {connection.url && (
                    <p className="text-sm text-gray-400">{connection.url}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Connected: {new Date(connection.timestamp).toLocaleString()}
                  </p>
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      connection.status === 'connected'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {connection.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => revokeConnection(connection)}
                  className="text-red-500 hover:text-red-600"
                  title="Disconnect"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-400 py-4">No connected apps</p>
        )}
      </div>
    </div>
  );
}