import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

const zipFile = './rf-servis (3).zip';
const targetDir = './';

try {
  const zip = new AdmZip(zipFile);
  zip.extractAllTo(targetDir, true);
  console.log('Zip extracted successfully!');
} catch (error) {
  console.error('Error extracting zip:', error);
}
