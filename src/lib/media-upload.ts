import api from '@/lib/api';

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);

  if (!match) {
    throw new Error('Image data is invalid. Please choose the image again.');
  }

  const contentType = match[1] || 'image/png';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
};

export const uploadHospitalLogo = async ({
  hospitalId,
  file,
}: {
  hospitalId: string;
  file: File;
}): Promise<string | null> => {
  const contentType = file.type || 'image/png';

  const sessionResponse = await api.post(`/hospitals/${hospitalId}/logo/upload-session`, {
    contentType,
    fileSize: file.size,
  });

  const uploadUrl = sessionResponse.data?.data?.uploadUrl;
  const uploadToken = sessionResponse.data?.data?.uploadToken;
  const sessionContentType = sessionResponse.data?.data?.contentType || contentType;

  if (!uploadUrl || !uploadToken) {
    throw new Error('Unable to start hospital logo upload.');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': sessionContentType,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Hospital logo upload failed. Please try again.');
  }

  const completeResponse = await api.post(`/hospitals/${hospitalId}/logo/upload-complete`, {
    uploadToken,
  });

  return completeResponse.data?.data?.logoUrl || null;
};

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to read image file.'));
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });

export { dataUrlToBlob };
