import React from 'react';

export function XRPScanLink({ type, value, network }) {
  const baseUrl = `https://${network === 'mainnet' ? '' : 'test.'}xrpscan.com`;
  const path = type === 'address' ? '/account/' : '/tx/';
  
  return (
    <a
      href={`${baseUrl}${path}${value}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 hover:text-blue-600 hover:underline"
    >
      {value.substring(0, 12)}...{value.substring(value.length - 8)}
    </a>
  );
}