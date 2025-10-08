import React from 'react';

export function TokenInfo({ token }) {
  return (
    <div className="bg-gray-800 text-white p-6 rounded-lg">
      <h2 className="text-2xl font-bold text-yellow-500 mb-6">Token Information</h2>
      
      <div className="grid grid-cols-2 gap-6">
        <InfoItem label="Issuer" value={token.issuer} />
        <InfoItem label="Name" value={token.name} />
        <InfoItem label="Currency" value={token.currency} />
        <InfoItem 
          label="Currency (HEX-Code)" 
          value={token.currencyHex} 
          className="break-all"
        />
        <InfoItem label="Supply" value={token.supply} />
        <InfoItem 
          label="Supply fixed" 
          value={token.supplyFixed ? "✅" : "❌"} 
        />
        <InfoItem 
          label="KYC" 
          value={token.kyc ? "✅" : "❌"} 
        />
        <InfoItem label="Provided by" value={token.provider} />
        <InfoItem label="Trustlines" value={token.trustlines} />
        <InfoItem label="DEX Offers" value={token.dexOffers} />
        
        {token.twitter && (
          <InfoItem 
            label="Twitter" 
            value={
              <a 
                href={`https://twitter.com/${token.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-500 hover:text-yellow-400"
              >
                @{token.twitter}
              </a>
            }
          />
        )}
        
        {token.domain && (
          <InfoItem 
            label="Domain" 
            value={
              <a 
                href={`https://${token.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-500 hover:text-yellow-400"
              >
                {token.domain}
              </a>
            }
          />
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value, className = "" }) {
  return (
    <div className="mb-4">
      <div className="text-gray-400 text-sm mb-1">{label}:</div>
      <div className={`font-medium ${className}`}>{value}</div>
    </div>
  );
}