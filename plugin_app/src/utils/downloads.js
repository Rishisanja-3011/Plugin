import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { api, getApiBaseUrlsForRequest, getAuthToken, rememberApiBaseUrl } from '../api/client';

const safeName = (value, fallback) => {
  const cleaned = String(value || fallback).replace(/[^a-zA-Z0-9-_]/g, '_');
  return cleaned || fallback;
};

const ensureInvoiceDirectory = () => {
  const directory = new Directory(Paths.cache, 'plugin-invoices');
  directory.create({ intermediates: true, idempotent: true });
  return directory;
};

const downloadAuthenticatedFile = async (path, destination, token) => {
  const baseUrls = await getApiBaseUrlsForRequest({ method: 'GET', authenticated: true });
  const separator = path.includes('?') ? '&' : '?';
  let lastError = null;

  for (const baseUrl of baseUrls) {
    try {
      await File.downloadFileAsync(
        `${baseUrl}${path}${separator}t=${Date.now()}`,
        destination,
        {
          headers: { Authorization: `Bearer ${token}` },
          idempotent: true,
        }
      );
      await rememberApiBaseUrl(baseUrl);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const error = new Error('Cannot reach Plugin server to download the invoice. Please check your connection and try again.');
  error.cause = lastError;
  throw error;
};

export async function downloadInvoicePdf(bill) {
  if (!bill?.id) throw new Error('Invoice is not available yet.');

  const token = await getAuthToken();
  if (!token) throw new Error('Please log in again to download the invoice.');

  const directory = ensureInvoiceDirectory();
  const baseName = safeName(bill.invoiceNumber, `invoice-${bill.id}`);
  const fileName = `${baseName}.pdf`;
  const destination = new File(directory, fileName);
  await downloadAuthenticatedFile(api.bills.invoicePath(bill.id), destination, token);

  if (Platform.OS === 'android') {
    const downloadsUri = LegacyFileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
    const permission = await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);
    if (!permission.granted) throw new Error('Download cancelled. Select a folder to save the invoice.');

    let publicUri;
    try {
      publicUri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        baseName,
        'application/pdf'
      );
    } catch {
      publicUri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        `${baseName}_${Date.now()}`,
        'application/pdf'
      );
    }
    const contents = await destination.base64();
    await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(publicUri, contents, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return { uri: publicUri, fileName, location: 'Downloads' };
  }

  const savedDirectory = new Directory(Paths.document, 'plugin-invoices');
  savedDirectory.create({ intermediates: true, idempotent: true });
  const savedFile = new File(savedDirectory, fileName);
  destination.copy(savedFile);
  return { uri: savedFile.uri, fileName, location: 'Plugin invoices' };
}
