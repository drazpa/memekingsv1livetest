/*
  # Update Image URLs to Dedicated Pinata Gateway

  This migration updates all existing image URLs to use the dedicated Pinata gateway
  for faster loading and better performance.

  1. Changes
    - Updates all `image_url` values in `meme_tokens` table
    - Replaces `gateway.pinata.cloud` with dedicated gateway
    - Replaces `ipfs.io` with dedicated gateway
    - Also updates `updated_at` timestamp to trigger cache refresh
*/

UPDATE meme_tokens
SET 
  image_url = REPLACE(REPLACE(
    image_url,
    'https://gateway.pinata.cloud/ipfs/',
    'https://violet-elderly-stoat-780.mypinata.cloud/ipfs/'
  ),
  'https://ipfs.io/ipfs/',
  'https://violet-elderly-stoat-780.mypinata.cloud/ipfs/'),
  updated_at = now()
WHERE image_url IS NOT NULL
  AND (
    image_url LIKE '%gateway.pinata.cloud%'
    OR image_url LIKE '%ipfs.io%'
  );
