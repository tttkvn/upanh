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
const GITHUB_API_BASE = 'https://api.github.com';

type ImageObject = {
  id: string; // SHA
  src: string; // download_url
  name: string;
  path: string;
  sha: string;
};

type ImageState = Record<string, ImageObject[]>;

// Helper function to remove Vietnamese diacritics
const removeDiacritics = (str: string) => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
};

const getCategoryPath = (category: string) => {
    const sanitizedCategory = removeDiacritics(category).replace(/\s+/g, '');
    return `image/${sanitizedCategory}`;
};

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

  // GitHub state
  const [githubToken, setGithubToken] = useState<string>('');
  const [repo, setRepo] = useState<string>('');
  const [branch, setBranch] = useState<string>('main');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(true);


  const loadImagesFromRepo = async () => {
    if (!githubToken || !repo) {
      setNotification('Vui lòng cung cấp GitHub Token và Repository.');
      setTimeout(() => setNotification(''), 3000);
      return;
    }
    setIsLoading(true);
    setNotification('Đang tải ảnh từ repository...');
    
    const newImageState: ImageState = CATEGORIES.reduce((acc, category) => {
      acc[category] = [];
      return acc;
    }, {} as ImageState);

    try {
      for (const category of CATEGORIES) {
        const categoryPath = getCategoryPath(category);
        const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${categoryPath}?ref=${branch}`;
        
        const response = await fetch(url, {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (response.status === 404) {
          console.log(`Category path '${categoryPath}' not found in repo. Skipping.`);
          continue;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Lỗi khi tải ${category}: ${errorData.message}`);
        }

        const files: any[] = await response.json();
        const imageFiles = files
          .filter(file => file.type === 'file' && /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name))
          .map(file => ({
            id: file.sha,
            src: file.download_url,
            name: file.name,
            path: file.path,
            sha: file.sha,
          }));
        
        newImageState[category] = imageFiles;
      }
      setImages(newImageState);
      setNotification('Tải ảnh thành công!');
    } catch (error: any) {
      console.error(error);
      setNotification(`Lỗi: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(''), 3000);
    }
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!githubToken || !repo) {
        setNotification('Vui lòng cấu hình GitHub trước.');
        setTimeout(() => setNotification(''), 3000);
        return;
    }
    setIsLoading(true);

    const uploadPromises = Array.from(files).map(file => {
        return new Promise<ImageObject>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    if (!e.target?.result) {
                        return reject(new Error('Lỗi khi đọc file.'));
                    }
                    const base64content = (e.target.result as string).split(',')[1];
                    const categoryPath = getCategoryPath(selectedCategory);
                    const filePath = `${categoryPath}/${file.name}`;
                    const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${filePath}`;

                    const response = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            Authorization: `token ${githubToken}`,
                            Accept: 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: `feat: add image ${file.name}`,
                            content: base64content,
                            branch: branch,
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        return reject(new Error(`GitHub API Error: ${errorData.message}`));
                    }
                    
                    const data = await response.json();
                    resolve({
                        id: data.content.sha,
                        src: data.content.download_url,
                        name: data.content.name,
                        path: data.content.path,
                        sha: data.content.sha,
                    });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    });

    Promise.all(uploadPromises)
        .then(newImages => {
            setImages(prevImages => ({
                ...prevImages,
                [selectedCategory]: [...prevImages[selectedCategory], ...newImages],
            }));
            setNotification(`${newImages.length} ảnh đã được tải lên thành công.`);
        })
        .catch(error => {
            console.error("Failed to upload files:", error);
            setNotification(`Lỗi khi tải lên: ${error.message}`);
        })
        .finally(() => {
            setIsLoading(false);
            setTimeout(() => setNotification(''), 3000);
            if (event.target) {
                event.target.value = '';
            }
        });
  }, [selectedCategory, githubToken, repo, branch]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleImageClick = async (image: ImageObject) => {
    if (!navigator.clipboard) {
      setNotification('Clipboard API không khả dụng trên trình duyệt này.');
      setTimeout(() => setNotification(''), 3000);
      return;
    }
    try {
      await navigator.clipboard.writeText(image.src);
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

  const handleDeleteConfirm = async () => {
    if (!modalState.imageId || !githubToken || !repo) return;
    
    const imageToDelete = images[selectedCategory].find(
        (img) => img.id === modalState.imageId
    );

    if (!imageToDelete) {
        setNotification('Không tìm thấy ảnh.');
        setTimeout(() => setNotification(''), 3000);
        closeDeleteModal();
        return;
    }
    
    setIsLoading(true);

    try {
        const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${imageToDelete.path}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `feat: delete image ${imageToDelete.name}`,
                sha: imageToDelete.sha,
                branch: branch,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }

        const updatedImagesForCategory = images[selectedCategory].filter(
            (img) => img.id !== modalState.imageId
        );
        
        const newImages = {
            ...images,
            [selectedCategory]: updatedImagesForCategory,
        };

        setImages(newImages);

        const newTotalPages = Math.ceil(updatedImagesForCategory.length / IMAGES_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
            setCurrentPage(newTotalPages);
        } else if (updatedImagesForCategory.length === 0) {
            setCurrentPage(1);
        }
        setNotification('Ảnh đã được xóa.');

    } catch (error: any) {
        console.error('Failed to delete image:', error);
        setNotification(`Lỗi khi xóa: ${error.message}`);
    } finally {
        setIsLoading(false);
        closeDeleteModal();
        setTimeout(() => setNotification(''), 3000);
    }
  };

  const activeImages = images[selectedCategory] || [];
  const totalPages = Math.ceil(activeImages.length / IMAGES_PER_PAGE);
  const startIndex = (currentPage - 1) * IMAGES_PER_PAGE;
  const displayedImages = activeImages.slice(startIndex, startIndex + IMAGES_PER_PAGE);

  return (
    <>
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
      <header className="app-header">
        <h1>Trình tải ảnh lên</h1>
        <button
          className="add-image-btn"
          onClick={triggerFileInput}
          aria-label={`Thêm ảnh vào ${selectedCategory}`}
          disabled={!githubToken || !repo || isLoading}
          title={!githubToken || !repo ? "Vui lòng cấu hình GitHub trước" : `Thêm ảnh vào ${selectedCategory}`}
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

      <div className="settings-panel">
        <header className={`settings-header ${isSettingsVisible ? 'open' : ''}`} onClick={() => setIsSettingsVisible(!isSettingsVisible)} aria-expanded={isSettingsVisible}>
          <h2>Cấu hình GitHub</h2>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </header>
        {isSettingsVisible && (
          <div className="settings-content">
            <div className="form-group">
              <label htmlFor="github-token">GitHub Personal Access Token</label>
              <input id="github-token" type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_..."/>
            </div>
            <div className="form-group">
              <label htmlFor="repo">Repository (owner/repo)</label>
              <input id="repo" type="text" value={repo} onChange={e => setRepo(e.target.value)} placeholder="username/my-image-repo" />
            </div>
            <div className="form-group">
              <label htmlFor="branch">Branch</label>
              <input id="branch" type="text" value={branch} onChange={e => setBranch(e.target.value)} />
            </div>
            <button className="load-btn" onClick={loadImagesFromRepo} disabled={isLoading || !githubToken || !repo}>
              {isLoading ? 'Đang tải...' : 'Tải ảnh từ Repo'}
            </button>
          </div>
        )}
      </div>
      
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
                  loading="lazy"
                />
                <button
                  className="delete-btn"
                  onClick={() => openDeleteModal(img.id)}
                  aria-label={`Xóa ảnh ${index + 1}`}
                  title="Xóa ảnh"
                  disabled={isLoading}
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
            <p>Chưa có ảnh nào trong thư mục '{selectedCategory}'. Hãy tải lên hoặc tải từ repository.</p>
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