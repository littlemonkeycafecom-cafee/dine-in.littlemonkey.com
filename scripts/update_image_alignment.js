import fs from 'node:fs';

const modalPath = 'src/components/ProductDetailsModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8');

// 1. Add state in ProductDetailsModal
if (!modalContent.includes('modalImgFit')) {
  modalContent = modalContent.replace(
    '  const [imageError, setImageError] = useState(false);',
    `  const [imageError, setImageError] = useState(false);
  const [modalImgFit, setModalImgFit] = useState<'contain' | 'cover'>('cover');
  const [modalImgLoaded, setModalImgLoaded] = useState(false);`
  );

  modalContent = modalContent.replace(
    '      setImageError(false);',
    `      setImageError(false);
      setModalImgLoaded(false);
      const isCold = product.category === 'cold-brew' || (product.image_url && product.image_url.includes('/cold-brew/'));
      setModalImgFit(isCold ? 'contain' : 'cover');`
  );
}

// 2. Update Image frame & img tag in ProductDetailsModal
const oldImgBlock = `{displayImage && !imageError ? (
            <img
              src={displayImage}
              alt={currentProduct.name}
              onError={() => setImageError(true)}
              className="lm-detail-img"
              style={{
                width: '100%',
                height: '100%',
                objectFit: displayImage.includes('/cold-brew/') ? 'contain' : 'cover',
                objectPosition: 'center',
                display: 'block',
                filter: displayImage.includes('/cold-brew/')
                  ? 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.9))'
                  : 'none',
              }}
            />
          )`;

const newImgBlock = `{displayImage && !imageError ? (
            <img
              src={displayImage}
              alt={currentProduct.name}
              onLoad={(e) => {
                const { naturalWidth, naturalHeight } = e.currentTarget;
                if (naturalWidth && naturalHeight) {
                  const isPortrait = naturalHeight > naturalWidth * 1.05;
                  const isDrinkOrCutout = displayImage.includes('/cold-brew/') || displayImage.endsWith('.png');
                  if (isPortrait || isDrinkOrCutout) {
                    setModalImgFit('contain');
                  } else {
                    setModalImgFit('cover');
                  }
                }
                setModalImgLoaded(true);
              }}
              onError={() => setImageError(true)}
              className="lm-detail-img"
              style={{
                width: '100%',
                height: '100%',
                objectFit: modalImgFit,
                objectPosition: 'center',
                display: 'block',
                padding: modalImgFit === 'contain' ? (displayImage.includes('/cold-brew/') ? '16px' : '8px') : '0',
                boxSizing: 'border-box',
                opacity: modalImgLoaded ? 1 : 0.4,
                transition: 'opacity 0.2s ease, transform 350ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                filter: displayImage.includes('/cold-brew/')
                  ? 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.9))'
                  : 'none',
              }}
            />
          )`;

// Replace regardless of line endings
const normModal = modalContent.replace(/\r\n/g, '\n');
const normOld = oldImgBlock.replace(/\r\n/g, '\n');
if (normModal.includes(normOld)) {
  modalContent = normModal.replace(normOld, newImgBlock);
  fs.writeFileSync(modalPath, modalContent, 'utf8');
  console.log('Successfully updated ProductDetailsModal.tsx img block');
} else {
  console.log('ProductDetailsModal old block not found, checking exact lines...');
}

// 3. Update MustTryRail.tsx
const mustTryPath = 'src/components/MustTryRail.tsx';
let mustTryContent = fs.readFileSync(mustTryPath, 'utf8');

const oldRailImg = `{displayImage ? (
                  <img
                    src={displayImage}
                    alt={product.name}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )`;

const newRailImg = `{displayImage ? (
                  <img
                    src={displayImage}
                    alt={product.name}
                    loading="lazy"
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      if (naturalHeight > naturalWidth * 1.05 || displayImage.includes('/cold-brew/') || displayImage.endsWith('.png')) {
                        e.currentTarget.style.objectFit = 'contain';
                        e.currentTarget.style.padding = '6px';
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: displayImage.includes('/cold-brew/') ? 'contain' : 'cover',
                      objectPosition: 'center',
                      display: 'block',
                      boxSizing: 'border-box',
                    }}
                  />
                )`;

const normRail = mustTryContent.replace(/\r\n/g, '\n');
const normOldRail = oldRailImg.replace(/\r\n/g, '\n');
if (normRail.includes(normOldRail)) {
  mustTryContent = normRail.replace(normOldRail, newRailImg);
  fs.writeFileSync(mustTryPath, mustTryContent, 'utf8');
  console.log('Successfully updated MustTryRail.tsx img block');
} else {
  console.log('MustTryRail old block not found, checking exact lines...');
}
