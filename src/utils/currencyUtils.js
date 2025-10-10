// Currency utilities for XRPL tokens

// Convert hex to string for currency codes
export function hexToString(hex) {
  if (typeof hex !== 'string' || !hex) {
    return hex;
  }

  // Remove any trailing zeros
  const trimmedHex = hex.replace(/0+$/, '');
  
  if (!/^[0-9A-F]+$/i.test(trimmedHex)) {
    return hex;
  }

  if (!trimmedHex) {
    return hex;
  }

  try {
    if (trimmedHex.length % 2 === 0) {
      const str = Buffer.from(trimmedHex, 'hex').toString('utf8');
      if (/^[\x20-\x7E]*$/.test(str)) {
        return str;
      }
    }
  } catch (error) {
    return hex;
  }
  
  return hex;
}

// Known currency codes mapping with extensive token information
const KNOWN_CURRENCIES = {
  // MINT Token
  '4D494E5400000000000000000000000000000000': {
    name: 'MINT',
    provider: 'MagicMint',
    twitter: 'MagicMintXRPL',
    domain: 'magicmint.co',
    description: 'MagicMint Token',
    issuer: 'rwCsCz93A1svS6Yv8hFqUeKLdTLhBpvqGD',
    supply: '499987082.62860745'
  },
  // MAGIC Token
  '4D41474943000000000000000000000000000000': {
    name: 'MAGIC',
    provider: 'Magic Protocol',
    description: 'Magic Protocol Token',
    issuer: 'rwCsCz93A1svS6Yv8hFqUeKLdTLhBpvqGD',
    supply: '49998343.235757105'
  },
  // MAGICIAN Token
  '4D4147494349414E000000000000000000000000': {
    name: 'MAGICIAN',
    provider: 'MAGICIAN',
    description: 'MAGICIAN Token',
    issuer: 'rPmSrav91WZYRaPYjsDndvBfTWNrmSqqXv',
    supply: '93741121.81641501'
  },
  // WIZARD Token
  '57495A4152440000000000000000000000000000': {
    name: 'WIZARD',
    provider: 'WIZARD',
    description: 'WIZARD Token',
    issuer: 'rMJszVPMxcUP9j3oU6M88jcyYajBmHJTB3',
    supply: '44927249.41177718'
  },
  // SHAMAN Token
  '5348414D414E0000000000000000000000000000': {
    name: 'SHAMAN',
    provider: 'SHAMAN',
    description: 'SHAMAN Token',
    issuer: 'rLaG4CMBnechoGkhhc6RApvytdeHCv67av',
    supply: '21511862.153694924'
  },
  // USDM Token
  '5553444D00000000000000000000000000000000': {
    name: 'USDM',
    provider: 'USDM',
    description: 'USDM Token',
    issuer: 'rpa92tGWP4bEAC8NPDMQxTydwn8Nshvdtd',
    supply: '99999861.58884008'
  },
  // RLUSD Token
  '524C555344000000000000000000000000000000': {
    name: 'RLUSD',
    provider: 'RLUSD',
    description: 'RLUSD Token',
    issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
  },
  // XRP Token
  '5852500000000000000000000000000000000000': {
    name: 'XRP',
    provider: 'Ripple',
    description: 'XRP Token'
  }
};

// Map of known issuers to their details
const KNOWN_ISSUERS = {
  'rwCsCz93A1svS6Yv8hFqUeKLdTLhBpvqGD': {
    name: 'MagicMint',
    domain: 'magicmint.co',
    defaultCurrency: 'MINT'
  },
  'rPmSrav91WZYRaPYjsDndvBfTWNrmSqqXv': {
    name: 'MAGICIAN',
    defaultCurrency: 'MAGICIAN'
  },
  'rMJszVPMxcUP9j3oU6M88jcyYajBmHJTB3': {
    name: 'WIZARD',
    defaultCurrency: 'WIZARD'
  },
  'rLaG4CMBnechoGkhhc6RApvytdeHCv67av': {
    name: 'SHAMAN',
    defaultCurrency: 'SHAMAN'
  },
  'rpa92tGWP4bEAC8NPDMQxTydwn8Nshvdtd': {
    name: 'USDM',
    defaultCurrency: 'USDM'
  },
  'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De': {
    name: 'RLUSD',
    defaultCurrency: 'RLUSD'
  }
};

export function getCurrencyInfo(hex, issuer = '') {
  // If hex is not a string or empty, return basic info
  if (typeof hex !== 'string' || !hex) {
    return {
      name: 'Unknown',
      currencyHex: hex || '',
      description: 'Unknown Token'
    };
  }

  // First check if it's a known currency
  if (KNOWN_CURRENCIES[hex]) {
    return {
      ...KNOWN_CURRENCIES[hex],
      currencyHex: hex
    };
  }
  
  // Try to convert from hex
  const name = hexToString(hex);
  const isKnownIssuer = KNOWN_ISSUERS[issuer];

  // If we have a known issuer, use that information
  if (isKnownIssuer) {
    return {
      name: isKnownIssuer.defaultCurrency || name,
      currencyHex: hex,
      provider: isKnownIssuer.name,
      domain: isKnownIssuer.domain,
      description: `${isKnownIssuer.name} ${isKnownIssuer.defaultCurrency || name} Token`
    };
  }

  // Default case - use the decoded name if available
  return {
    name: name === hex ? 'Unknown' : name,
    currencyHex: hex,
    description: name === hex ? 'Unknown Token' : `${name} Token`
  };
}

export function formatCurrencyDisplay(currencyHex, issuer = '') {
  const info = getCurrencyInfo(currencyHex, issuer);
  return info.name || 'Unknown';
}

export function getTokenSymbol(currencyHex, issuer = '') {
  const info = getCurrencyInfo(currencyHex, issuer);
  return info.name || 'Unknown';
}

export function getTokenName(currencyHex, issuer = '') {
  const info = getCurrencyInfo(currencyHex, issuer);
  return info.description || 'Unknown Token';
}

export function getTokenProvider(currencyHex, issuer = '') {
  const info = getCurrencyInfo(currencyHex, issuer);
  return info.provider || 'Unknown Provider';
}

export function formatBalance(balance, decimals = 6) {
  if (!balance) return '0.00';
  return parseFloat(balance).toFixed(decimals);
}