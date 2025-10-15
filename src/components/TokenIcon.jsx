import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { imageCacheManager, extractIpfsHash as extractHash, normalizeImageUrl } from '../utils/imageCache';

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];

function TokenIcon({ token, size = 'md', className = '' }) {
  const cacheKey = useMemo(() => `token-img-${token.id}`, [token.id]);
  const stableImageUrl = useMemo(() => token.image_url, [token.image_url]);

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentGatewayIndex, setCurrentGatewayIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const imageUrlRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState(null);
  const mountedRef = useRef(true);

  const sizeClasses = {
    sm: 'w-8 h-8 min-w-[2rem] min-h-[2rem] text-sm',
    md: 'w-12 h-12 min-w-[3rem] min-h-[3rem] text-xl',
    lg: 'w-16 h-16 min-w-[4rem] min-h-[4rem] text-2xl',
    xl: 'w-20 h-20 min-w-[5rem] min-h-[5rem] text-3xl',
    '2xl': 'w-24 h-24 min-w-[6rem] min-h-[6rem] text-4xl',
    '3xl': 'w-32 h-32 min-w-[8rem] min-h-[8rem] text-6xl'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!stableImageUrl) {
      setImageError(true);
      return;
    }

    if (imageUrlRef.current === stableImageUrl && imageLoaded) {
      return;
    }

    const loadImage = async () => {
      const cached = await imageCacheManager.get(cacheKey);
      if (cached && mountedRef.current) {
        setCurrentUrl(cached);
        setImageLoaded(true);
        setImageError(false);
        imageUrlRef.current = stableImageUrl;
        return;
      }

      if (imageUrlRef.current !== stableImageUrl) {
        if (mountedRef.current) {
          setImageError(false);
          setImageLoaded(false);
          setCurrentGatewayIndex(0);
          setRetryCount(0);
        }
        imageUrlRef.current = stableImageUrl;

        let imageUrl = normalizeImageUrl(stableImageUrl);

        if (imageUrl.includes('gateway.pinata.cloud') || imageUrl.includes('ipfs.io') || imageUrl.includes('cloudflare-ipfs.com') || imageUrl.includes('dweb.link')) {
          if (mountedRef.current) {
            setCurrentUrl(imageUrl);
          }
        } else {
          const ipfsHash = extractHash(stableImageUrl);
          if (ipfsHash) {
            imageUrl = `${IPFS_GATEWAYS[0]}${ipfsHash}`;
          }
          if (mountedRef.current) {
            setCurrentUrl(imageUrl);
          }
        }
      }
    };

    loadImage();
  }, [stableImageUrl, cacheKey, imageLoaded]);

  const handleImageError = () => {
    console.error('Image load error for token:', token.token_name, 'URL:', currentUrl, 'Gateway:', currentGatewayIndex, 'Retry:', retryCount);

    const ipfsHash = extractHash(token.image_url);

    if (ipfsHash && currentGatewayIndex < IPFS_GATEWAYS.length - 1) {
      console.log('Trying next gateway...');
      const nextGateway = currentGatewayIndex + 1;
      setCurrentGatewayIndex(nextGateway);
      setCurrentUrl(`${IPFS_GATEWAYS[nextGateway]}${ipfsHash}`);
      setRetryCount(0);
    } else if (retryCount < 1) {
      console.log('Retrying from first gateway...');
      setRetryCount(prev => prev + 1);
      if (ipfsHash) {
        setCurrentGatewayIndex(0);
        setCurrentUrl(`${IPFS_GATEWAYS[0]}${ipfsHash}`);
      }
    } else {
      console.error('All gateways failed for:', token.token_name);
      setImageError(true);
    }
  };

  if (currentUrl && !imageError) {
    return (
      <div className={`relative inline-block ${sizeClass} flex-shrink-0`}>
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-purple-500 bg-gradient-to-br from-purple-500 to-purple-700">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold">
              {token.token_name[0]}
            </div>
          )}
          <img
            key={`${token.id}-${currentGatewayIndex}-${retryCount}`}
            src={currentUrl}
            alt={token.token_name}
            className={`w-full h-full object-cover transition-opacity duration-200 ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
            onLoad={async () => {
              if (!mountedRef.current) return;
              await imageCacheManager.set(cacheKey, currentUrl);
              if (mountedRef.current) {
                setImageLoaded(true);
              }
            }}
            onError={handleImageError}
            loading="lazy"
            decoding="async"
            crossOrigin="anonymous"
          />
        </div>
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
