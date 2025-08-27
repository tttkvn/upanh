/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

const CATEGORIES = [
  'NPC Nam',
  'NPC Nam tấn công',
  'NPC Nữ',
  'NPC Nữ Tấn công',
  'Quái vật',
  'Quái vật tấn công',
  'trang bị',
  'Trang bị Vip',
  'Nền',
  'Nhà',
  'Khác',
];

const IMAGES_PER_PAGE = 12;

type ImageObject = {
  id: string;
  src: string;
  name: string;
};

type ImageState = Record<string, ImageObject[]>;

const App = () => {
  const [images, setImages] = useState<ImageState>(() =>
    CATEGORIES.reduce((acc, category) => {
      acc[category] = [];
      return acc;
    }, {} as ImageState)
  );

  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [notification, setNotification] = useState<string>('');
  const [modalState, setModalState] = useState<{isOpen: boolean; imageId: string | null}>({ isOpen: false, imageId: null });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const imageReadPromises = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .map(file => {
        return new Promise<{ src: string; name: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => {
            if (e.target?.result) {
              resolve({ src: e.target.result as string, name: file.name });
            } else {
              reject(new Error('Failed to read file.'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

    if (imageReadPromises.length > 0) {
      Promise.all(imageReadPromises)
        .then(newImageData => {
          const newImages = newImageData.map(data => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            src: data.src,
            name: data.name,
          }));
          setImages(prevImages => ({
            ...prevImages,
            [selectedCategory]: [...prevImages[selectedCategory], ...newImages],
          }));
        })
        .catch(error => {
          console.error("Failed to read files:", error);
          setNotification('Lỗi khi tải ảnh lên.');
          setTimeout(() => setNotification(''), 3000);
        });
    }

    // Reset file input to allow re-uploading the same file
    if (event.target) {
        event.target.value = '';
    }
  }, [selectedCategory]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleImageClick = async (image: ImageObject) => {
    if (!navigator.clipboard) {
      setNotification('Clipboard API not available on this browser.');
      setTimeout(() => setNotification(''), 3000);
      return;
    }

    // Helper function to remove Vietnamese diacritics
    const removeDiacritics = (str: string) => {
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D');
    };

    // Format the category name: remove diacritics and spaces
    const categoryPath = removeDiacritics(selectedCategory).replace(/\s+/g, '');

    // Get the image name without the extension (e.g., "1.png" -> "1")
    const imageNameWithoutExtension = image.name.replace(/\.[^/.]+$/, "");

    // Construct the final path with the domain name
    const imagePath = `${window.location.origin}/${categoryPath}/${imageNameWithoutExtension}`;

    try {
      await navigator.clipboard.writeText(imagePath);
      setNotification('Đã sao chép đường dẫn ảnh!');
    } catch (err) {
      console.error('Failed to copy: ', err);
      setNotification('Lỗi khi sao chép!');
    } finally {
      setTimeout(() => setNotification(''), 3000);
    }
  };


  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const openDeleteModal = (imageId: string) => {
    setModalState({ isOpen: true, imageId });
  };

  const closeDeleteModal = () => {
    setModalState({ isOpen: false, imageId: null });
  };

  const handleDeleteConfirm = () => {
    if (!modalState.imageId) return;

    const updatedImagesForCategory = images[selectedCategory].filter(
        (img) => img.id !== modalState.imageId
    );
    
    const newImages = {
        ...images,
        [selectedCategory]: updatedImagesForCategory,
    };

    setImages(newImages);

    // Adjust pagination
    const newTotalPages = Math.ceil(updatedImagesForCategory.length / IMAGES_PER_PAGE);
    if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
    } else if (updatedImagesForCategory.length === 0) {
        setCurrentPage(1);
    }

    closeDeleteModal();
    setNotification('Ảnh đã được xóa.');
    setTimeout(() => setNotification(''), 3000);
  };

  const activeImages = images[selectedCategory] || [];
  const totalPages = Math.ceil(activeImages.length / IMAGES_PER_PAGE);
  const startIndex = (currentPage - 1) * IMAGES_PER_PAGE;
  const displayedImages = activeImages.slice(startIndex, startIndex + IMAGES_PER_PAGE);

  return (
    <>
      <header className="app-header">
        <h1>Trình tải ảnh lên</h1>
        <button
          className="add-image-btn"
          onClick={triggerFileInput}
          aria-label={`Thêm ảnh vào ${selectedCategory}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Thêm Ảnh vào '{selectedCategory}'
        </button>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      </header>
      
      <nav className="category-nav">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => handleCategoryClick(category)}
            aria-pressed={selectedCategory === category}
          >
            {category}
          </button>
        ))}
      </nav>

      <main className="content-area">
        {displayedImages.length > 0 ? (
          <div className="image-grid">
            {displayedImages.map((img, index) => (
              <div className="image-container" key={img.id}>
                <img
                  src={img.src}
                  alt={`${selectedCategory} image ${index + 1}`}
                  title="Nhấp để sao chép đường dẫn"
                  onClick={() => handleImageClick(img)}
                />
                <button
                  className="delete-btn"
                  onClick={() => openDeleteModal(img.id)}
                  aria-label={`Xóa ảnh ${index + 1}`}
                  title="Xóa ảnh"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.71c-1.123 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Chưa có ảnh nào trong thư mục '{selectedCategory}'.</p>
          </div>
        )}
      </main>

      {totalPages > 1 && (
        <footer className="pagination">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            Trước
          </button>
          <span>Trang {currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            Sau
          </button>
        </footer>
      )}

      {modalState.isOpen && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Xác nhận xóa</h2>
            <p>Bạn có chắc chắn muốn xóa ảnh này không?</p>
            <div className="modal-actions">
              <button onClick={handleDeleteConfirm} className="modal-btn confirm">Xóa</button>
              <button onClick={closeDeleteModal} className="modal-btn cancel">Hủy</button>
            </div>
          </div>
        </div>
      )}

      {notification && <div className="notification">{notification}</div>}
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}