import { useState, useEffect, useRef, memo } from 'react';

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];

const imageCache = new Map();

function TokenIcon({ token, size = 'md', className = '' }) {
  const cacheKey = `${token.id}-${token.image_url}`;
  const isCached = imageCache.has(cacheKey);

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(isCached);
  const [currentGatewayIndex, setCurrentGatewayIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const imageUrlRef = useRef(null);

  const sizeClasses = {
    sm: 'w-8 h-8 min-w-[2rem] min-h-[2rem] text-sm',
    md: 'w-12 h-12 min-w-[3rem] min-h-[3rem] text-xl',
    lg: 'w-16 h-16 min-w-[4rem] min-h-[4rem] text-2xl',
    xl: 'w-20 h-20 min-w-[5rem] min-h-[5rem] text-3xl',
    '3xl': 'w-24 h-24 min-w-[6rem] min-h-[6rem] text-4xl'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  useEffect(() => {
    if (imageCache.has(cacheKey)) {
      setImageLoaded(true);
      setImageError(false);
      return;
    }

    if (imageUrlRef.current !== token.image_url) {
      setImageError(false);
      setImageLoaded(false);
      setCurrentGatewayIndex(0);
      setRetryCount(0);
      imageUrlRef.current = token.image_url;
    }
  }, [token.image_url, token.id, cacheKey]);

  const extractIpfsHash = (url) => {
    if (!url) return null;

    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', '');
    }

    const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (ipfsMatch) {
      return ipfsMatch[1];
    }

    if (!url.startsWith('http')) {
      return url;
    }

    return null;
  };

  const handleImageError = () => {
    console.error('Image load error for token:', token.token_name, 'Gateway:', currentGatewayIndex, 'Retry:', retryCount);

    if (currentGatewayIndex < IPFS_GATEWAYS.length - 1) {
      console.log('Trying next gateway...');
      setCurrentGatewayIndex(prev => prev + 1);
      setRetryCount(0);
    } else if (retryCount < 2) {
      console.log('Retrying current gateway...');
      setRetryCount(prev => prev + 1);
      setCurrentGatewayIndex(0);
    } else {
      console.error('All gateways failed for:', token.token_name);
      setImageError(true);
    }
  };

  if (token.image_url && !imageError) {
    let imageUrl = token.image_url;
    const ipfsHash = extractIpfsHash(token.image_url);

    if (ipfsHash) {
      imageUrl = `${IPFS_GATEWAYS[currentGatewayIndex]}${ipfsHash}`;
    }

    const finalUrl = imageUrl;

    return (
      <div className={`relative inline-block ${sizeClass} flex-shrink-0`}>
        {!imageLoaded && (
          <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold ${className}`}>
            {token.token_name[0]}
          </div>
        )}
        <img
          key={`${token.id}-${currentGatewayIndex}-${retryCount}`}
          src={finalUrl}
          alt={token.token_name}
          className={`${sizeClass} rounded-full object-cover border-2 border-purple-500 ${className} transition-opacity duration-200 ${!imageLoaded ? 'opacity-0' : 'opacity-100'} aspect-square`}
          onLoad={() => {
            const cacheKey = `${token.id}-${token.image_url}`;
            imageCache.set(cacheKey, true);
            setImageLoaded(true);
          }}
          onError={handleImageError}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold ${className} flex-shrink-0 aspect-square`}>
      {token.token_name[0]}
    </div>
  );
}

export default memo(TokenIcon, (prevProps, nextProps) => {
  return (
    prevProps.token.id === nextProps.token.id &&
    prevProps.token.image_url === nextProps.token.image_url &&
    prevProps.size === nextProps.size &&
    prevProps.className === nextProps.className
  );
});
