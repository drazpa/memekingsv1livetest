import { useState, useEffect } from 'react';

export default function TokenIcon({ token, size = 'md', className = '' }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-xl',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-20 h-20 text-3xl'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [token.image_url, token.updated_at, token.id]);

  if (token.image_url && !imageError) {
    const timestamp = token.updated_at
      ? new Date(token.updated_at).getTime()
      : token.created_at
        ? new Date(token.created_at).getTime()
        : Date.now();

    let imageUrl = token.image_url;

    if (imageUrl.startsWith('ipfs://')) {
      imageUrl = imageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
    } else if (!imageUrl.startsWith('http')) {
      imageUrl = `https://gateway.pinata.cloud/ipfs/${imageUrl}`;
    }

    const finalUrl = imageUrl.includes('?')
      ? `${imageUrl}&t=${timestamp}`
      : `${imageUrl}?t=${timestamp}`;

    return (
      <div className="relative inline-block">
        {!imageLoaded && (
          <div className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold ${className}`}>
            {token.token_name[0]}
          </div>
        )}
        <img
          src={finalUrl}
          alt={token.token_name}
          className={`${sizeClass} rounded-full object-cover border-2 border-purple-500 ${className} ${!imageLoaded ? 'absolute inset-0 opacity-0' : ''}`}
          onLoad={() => {
            console.log('Image loaded successfully:', token.token_name, finalUrl);
            setImageLoaded(true);
          }}
          onError={(e) => {
            console.error('Image load error for token:', token.token_name, 'URL:', finalUrl, 'Original:', token.image_url);
            setImageError(true);
          }}
          crossOrigin="anonymous"
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold ${className}`}>
      {token.token_name[0]}
    </div>
  );
}
