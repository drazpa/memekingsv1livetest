const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export const uploadImageToPinata = async (file) => {
  try {
    console.log('Starting Pinata upload for file:', file.name);

    const formData = new FormData();
    formData.append('file', file);

    const metadata = JSON.stringify({
      name: `token-${Date.now()}-${file.name}`,
    });
    formData.append('pinataMetadata', metadata);

    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', options);

    console.log('Uploading to Pinata with JWT:', PINATA_JWT ? 'JWT exists' : 'JWT missing');

    const response = await fetch(PINATA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });

    console.log('Pinata response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Pinata error response:', errorData);
      throw new Error(`Failed to upload image to Pinata: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    console.log('Pinata upload successful:', data);

    const imageUrl = `${PINATA_GATEWAY}${data.IpfsHash}`;
    console.log('Generated image URL:', imageUrl);

    return imageUrl;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw error;
  }
};
