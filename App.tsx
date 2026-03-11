import React, { useState, useEffect, useCallback, useRef } from 'react';
import { extractConsolidatedInfo } from './services/geminiService';
import { sendDataToWebhook } from './services/notificationService';

// --- Helper Functions & Constants ---

const deepClean = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
        if (obj === null || obj === undefined || obj === '' || (typeof obj === 'string' && obj.toLowerCase() === 'null')) {
            return null;
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        const cleanedArray = obj.map(deepClean).filter(item => item !== null);
        return cleanedArray.length > 0 ? cleanedArray : null;
    }

    const cleanedObject = Object.entries(obj).reduce((acc, [key, value]) => {
        const cleanedValue = deepClean(value);
        if (cleanedValue !== null) {
            acc[key] = cleanedValue;
        }
        return acc;
    }, {} as { [key: string]: any });
    
    return Object.keys(cleanedObject).length > 0 ? cleanedObject : null;
};

const KEY_LABELS: { [key: string]: string } = {
    // Personal Info
    ho_ten: 'Họ và Tên',
    ngay_sinh: 'Ngày sinh',
    gioi_tinh: 'Giới tính',
    quoc_tich: 'Quốc tịch',
    dan_toc: 'Dân tộc',
    ton_giao: 'Tôn giáo',
    que_quan: 'Quê quán',
    noi_thuong_tru: 'Nơi thường trú',
    noi_o_hien_tai: 'Nơi ở hiện tại',
    noi_o_hien_nay: 'Nơi ở hiện nay',
    dac_diem_nhan_dang: 'Đặc điểm nhận dạng',
    ngay_cap: 'Ngày cấp',
    so_dien_thoai: 'Số điện thoại',
    thong_tin_ca_nhan: 'Thông Tin Cá Nhân',

    // ID documents
    so: 'Số định danh',
    so_cccd: 'Số CCCD',
    cccd_cmt: 'Số CCCD/CMND/DDCN',
    so_cmnd: 'Số CMND',
    noi_cap_cccd: 'Nơi cấp CCCD',
    noi_cap: 'Nơi cấp',

    // Address & Contact
    dia_chi: 'Địa chỉ',
    phuong_xa: 'Phường/Xã',
    quan_huyen: 'Quận/Huyện',
    tinh_thanh_pho: 'Tỉnh/Thành phố',
    tinh_tp: 'Tỉnh/TP',
    quoc_gia: 'Quốc gia',
    dia_chi_day_du: 'Địa chỉ đầy đủ',
    noi_sinh: 'Nơi sinh',
    tru_ngu_hien_tai: 'Trú ngụ hiện tại',
    noi_dk_ho_khau: 'Nơi ĐK hộ khẩu',
    noi_tam_tru: 'Nơi tạm trú',
    noi_o_hien_tai_khac: 'Nơi ở hiện tại khác',

    // Vehicle Info
    ho_ten_chu_xe: 'Chủ xe',
    bien_so: 'Biển số',
    loai_xe: 'Loại xe',
    nhan_hieu: 'Nhãn hiệu',
    so_loai: 'Số loại',
    mau_son: 'Màu sơn',
    so_may: 'Số máy',
    so_khung: 'Số khung',
    ngay_dang_ky: 'Ngày đăng ký',
    ngay_het_han: 'Ngày hết hạn',
    trang_thai_xe: 'Trạng thái xe',

    // Relationships & Others
    moi_quan_he: 'Mối quan hệ',
    nguoi_lien_quan: 'Người liên quan',
    quan_he: 'Quan hệ',
    tt: 'STT',
    nam_sinh: 'Năm sinh',
    thong_tin_lien_he_than_tin: 'Thông tin liên hệ thân tín',
    loai_giay_to: 'Loại giấy tờ',
    ghi_chu: 'Ghi chú',
    nghe_nghiep: 'Nghề nghiệp',
    chuc_vu_quyen_han: 'Chức vụ',
    noi_lam_viec: 'Nơi làm việc',
    tinh_trang_giao_dịch: 'Tình trạng giao dịch',
};

const formatKeyToLabel = (key: string): string => {
    return KEY_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// --- Helper Icon Components ---

const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const PasteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
);

const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
);

const RemoveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const PlusIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const NewJobIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
);

const LoadingSpinner = () => {
    const messages = [
        "Đang tải ảnh lên máy chủ...",
        "AI đang phân tích hình ảnh...",
        "Tổng hợp dữ liệu JSON...",
        "Sắp hoàn tất, vui lòng chờ!"
    ];
    const [currentMessage, setCurrentMessage] = useState(messages[0]);

    useEffect(() => {
        let messageIndex = 0;
        const intervalId = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setCurrentMessage(messages[messageIndex]);
        }, 2500); // Change message every 2.5 seconds

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="absolute inset-0 bg-slate-800 bg-opacity-80 flex flex-col items-center justify-center rounded-2xl z-40 backdrop-blur-md">
            <svg className="animate-spin h-14 w-14 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-8 text-2xl font-black text-sky-300 text-center uppercase">
                Đang Xử Lý
            </p>
            <p className="text-slate-400 mt-2 font-medium text-center transition-opacity duration-500">{currentMessage}</p>
        </div>
    );
};

// --- Main App Component ---

interface ImageFile {
    file: File;
    url: string;
}

const ImageLightbox: React.FC<{ imageUrl: string | null; onClose: () => void }> = ({ imageUrl, onClose }) => {
    if (!imageUrl) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 animate-fade-in" 
            onClick={onClose}
            style={{ animationDuration: '0.2s' }}
        >
            <div className="relative p-4 max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <img src={imageUrl} alt="Xem ảnh lớn" className="block w-full h-full object-contain rounded-lg shadow-2xl" />
                <button 
                    onClick={onClose} 
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-8 w-8 flex items-center justify-center text-lg font-bold shadow-lg hover:bg-red-500 transition-transform hover:scale-110"
                >
                    &times;
                </button>
            </div>
        </div>
    );
};

const WEBHOOK_URL = 'https://hook.eu1.make.com/sx07kcyl35wfcccccc1i4j1jywiwtxwr';

export default function App() {
    const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
    const [extractionResult, setExtractionResult] = useState<object | null>(null);
    const [formattedTextForCopy, setFormattedTextForCopy] = useState<string>('');
    const [resultPlaceholder, setResultPlaceholder] = useState<string>('Dữ liệu OCR tổng hợp sẽ hiển thị tại đây...');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
    const [isNotifying, setIsNotifying] = useState<boolean>(false);

    const addImages = useCallback((newFiles: File[]) => {
        const imageFiles = newFiles.filter(file => file.type.startsWith('image/'));
        const newImageObjects = imageFiles.map(file => ({ file, url: URL.createObjectURL(file) }));
        setSelectedImages(prev => [...prev, ...newImageObjects]);
        setError(null);
    }, []);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (event.clipboardData && event.clipboardData.files) {
                const files = Array.from(event.clipboardData.files);
                const imageFiles = files.filter(file => file.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                    event.preventDefault();
                    addImages(imageFiles);
                }
            }
        };
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [addImages]);

    const removeImage = useCallback((indexToRemove: number) => {
        setSelectedImages(prev => {
            const imageToRemove = prev[indexToRemove];
            if (imageToRemove) URL.revokeObjectURL(imageToRemove.url);
            return prev.filter((_, index) => index !== indexToRemove);
        });
    }, []);
    
    const handleNewJob = useCallback(() => {
        selectedImages.forEach(image => URL.revokeObjectURL(image.url));
        setSelectedImages([]);
        setExtractionResult(null);
        setFormattedTextForCopy('');
        setResultPlaceholder('Dữ liệu OCR tổng hợp sẽ hiển thị tại đây...');
        setError(null);
    }, [selectedImages]);

    const formatResultToText = (obj: any, indent = ''): string => {
        if (!obj || typeof obj !== 'object') return '';
    
        return Object.entries(obj)
            .map(([key, value]) => {
                const label = formatKeyToLabel(key);
                if (value && typeof value === 'object') {
                    if (Array.isArray(value)) {
                        // Special formatting for arrays
                        const itemsContent = value.map((item, index) => {
                            if (typeof item !== 'object' || item === null) {
                                return `${indent}  - ${item}`; // Handle arrays of strings/numbers
                            }
    
                            let headerLine = `${indent}  - Mục ${index + 1}:`;
                            const remainingItem = { ...item };
    
                            // Combine ho_ten and ngay_sinh into the header
                            if (remainingItem.ho_ten) {
                                headerLine += ` ${remainingItem.ho_ten}`;
                                delete remainingItem.ho_ten;
                                if (remainingItem.ngay_sinh) {
                                    headerLine += ` ${remainingItem.ngay_sinh}`;
                                    delete remainingItem.ngay_sinh;
                                }
                            }
                            
                            // Remove 'stt' (STT) field
                            const sttKey = Object.keys(remainingItem).find(k => k.toLowerCase() === 'stt');
                            if (sttKey) {
                                delete remainingItem[sttKey];
                            }
                            
                            const details = formatResultToText(remainingItem, indent + '    ');
                            
                            if (details) {
                                return `${headerLine}\n${details}`;
                            }
                            return headerLine;
    
                        }).join('\n');
                        return `${indent}• ${label}:\n${itemsContent}`;
                    }
                    // Standard object formatting
                    return `${indent}• ${label}:\n${formatResultToText(value, indent + '  ')}`;
                }
                // Simple key-value pair
                return `${indent}• ${label}: ${value}`;
            })
            .join('\n');
    };
    
    const handleExtract = useCallback(async () => {
        if (selectedImages.length === 0 || isLoading) return;
    
        setIsLoading(true);
        setError(null);
        setResultPlaceholder('Đang xử lý ảnh và trích xuất thành văn bản...');
        setFormattedTextForCopy('');
        setExtractionResult(null);
        
        try {
            const imageFiles = selectedImages.map(img => img.file);
            const rawResult = await extractConsolidatedInfo(imageFiles);
            const parsedJson = JSON.parse(rawResult);
            const cleanedJson = deepClean(parsedJson);
            setExtractionResult(cleanedJson);
            if (cleanedJson) {
                setFormattedTextForCopy(formatResultToText(cleanedJson));
            } else {
                 setFormattedTextForCopy('(Không tìm thấy dữ liệu hợp lệ)');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            setResultPlaceholder(`Lỗi: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [selectedImages, isLoading]);

    const handleSaveAndNotify = useCallback(async () => {
        if (!extractionResult) return;
        setIsNotifying(true);
        try {
            await sendDataToWebhook(extractionResult, WEBHOOK_URL);
            alert("✅ Đã gửi dữ liệu thành công lên CSDL!");
        } catch (error) {
            alert(`❌ Lỗi gửi CSDL: ${error}`);
        } finally {
            setIsNotifying(false);
        }
    }, [extractionResult]);

    useEffect(() => {
        return () => selectedImages.forEach(image => URL.revokeObjectURL(image.url));
    }, [selectedImages]);

    return (
        <>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }`}</style>
            <ImageLightbox imageUrl={viewingImageUrl} onClose={() => setViewingImageUrl(null)} />
            <div className="min-h-screen bg-slate-950 text-slate-200 p-3 sm:p-8 lg:p-12">
                <div className="max-w-7xl mx-auto">
                    <header className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
                        <div className="text-center sm:text-left">
                            <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-sky-400 via-sky-300 to-emerald-400 tracking-tighter uppercase">
                                TRÍCH XUẤT ẢNH ⮕ DỮ LIỆU
                            </h1>
                            <p className="text-sm text-slate-500 mt-2 font-bold uppercase tracking-[0.3em]">AI Gemini • SHPLC</p>
                        </div>
                        <button onClick={handleNewJob} className="flex items-center bg-slate-900 text-slate-400 font-black py-3 px-8 rounded-2xl hover:bg-slate-800 transition-all text-xs tracking-widest uppercase border border-slate-800">
                            <NewJobIcon /> LÀM MỚI
                        </button>
                    </header>
                    
                    <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                        <UploaderPanel images={selectedImages} onImagesSelect={addImages} onImageRemove={removeImage} onImageClick={setViewingImageUrl} onExtract={handleExtract} isLoading={isLoading} error={error} setError={setError} />
                        <ResultPanel formattedTextForCopy={formattedTextForCopy} placeholder={resultPlaceholder} isNotifying={isNotifying} onSaveAndNotify={handleSaveAndNotify} hasResult={!!extractionResult} />
                    </main>
                    <footer className="text-center py-12 text-slate-800 text-[10px] font-black uppercase tracking-[0.5em]">
                        <p>© 2026 OCR CONSOLIDATION ENGINE • POWERED BY GOOGLE AI</p>
                    </footer>
                </div>
            </div>
        </>
    );
}

// Internal components for the UI
interface UploaderPanelProps {
    images: ImageFile[];
    onImagesSelect: (files: File[]) => void;
    onImageRemove: (index: number) => void;
    onImageClick: (url: string) => void;
    onExtract: () => void;
    isLoading: boolean;
    error: string | null;
    setError: (error: string | null) => void;
}

const UploaderPanel: React.FC<UploaderPanelProps> = ({ images, onImagesSelect, onImageRemove, onImageClick, onExtract, isLoading, error, setError }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pasteFeedback, setPasteFeedback] = useState(false);

    const handleFileSelectClick = () => fileInputRef.current?.click();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) { onImagesSelect(Array.from(files)); event.target.value = ''; }
    };
    
    const handlePasteFromClipboard = async () => {
        if (!navigator.clipboard?.read) { setError("Trình duyệt không hỗ trợ nút dán. Hãy thử dùng Ctrl+V."); return; }
        try {
            setError(null);
            const clipboardItems = await navigator.clipboard.read();
            const imageFiles: File[] = [];
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const ext = imageType.split('/')[1] || 'png';
                    imageFiles.push(new File([blob], `pasted_${Date.now()}.${ext}`, { type: imageType }));
                }
            }
            if (imageFiles.length > 0) {
                onImagesSelect(imageFiles);
                setPasteFeedback(true);
                setTimeout(() => setPasteFeedback(false), 1000);
            } else { alert("Không tìm thấy ảnh trong bộ nhớ đệm."); }
        } catch (err: any) { setError("Lỗi dán ảnh. Hãy dùng phím tắt Ctrl+V."); }
    };

    return (
        <div className="bg-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl h-full flex flex-col relative border border-slate-700/50">
            {isLoading && <LoadingSpinner />}
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-sky-400 flex items-center tracking-tight">
                    <span className="bg-sky-500 text-slate-950 rounded-xl w-8 h-8 flex items-center justify-center mr-4 text-sm font-black shadow-lg shadow-sky-500/20">1</span>
                    NHẬP ẢNH
                </h3>
                <div className="bg-slate-900/60 px-3 py-1 rounded-full border border-slate-700">
                    <span className="text-xs text-sky-400 font-mono font-bold">{images.length} Ảnh</span>
                </div>
            </div>
            
            <div className="flex flex-col gap-4 mb-6">
                <button onClick={handlePasteFromClipboard} className={`flex flex-col items-center justify-center py-10 px-6 rounded-3xl transition-all border-2 border-dashed group ${pasteFeedback ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-900/60 border-sky-500/30 hover:bg-slate-700/60 hover:border-sky-500/60 active:bg-slate-900 active:scale-[0.98]'}`}>
                    {pasteFeedback ? (
                        <div className="flex flex-col items-center text-emerald-400">
                           <CheckIcon /><span className="font-black text-xl mt-2 uppercase tracking-widest">ĐÃ DÁN!</span>
                        </div>
                    ) : (
                        <><div className="text-sky-500/80 group-hover:text-sky-400 transition-colors"><PasteIcon /></div><div className="text-center mt-2"><span className="block font-black text-sky-300 text-lg sm:text-xl uppercase tracking-tight">Dán ảnh từ Clipboard</span><p className="text-xs text-slate-500 mt-1 font-medium leading-tight">Nhấn hoặc dùng Ctrl+V</p></div></>
                    )}
                </button>
                <button onClick={handleFileSelectClick} className="flex items-center justify-center bg-slate-700 hover:bg-slate-650 text-slate-300 font-bold py-4 px-6 rounded-2xl transition-all text-sm border border-slate-600 active:scale-95 shadow-lg">
                    <CameraIcon /> Chọn ảnh hoặc Chụp mới
                </button>
            </div>

            <div className="flex-grow bg-slate-900/60 rounded-2xl p-4 border border-slate-700/40 min-h-[180px] md:min-h-[300px] overflow-hidden">
                {images.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 overflow-y-auto max-h-[45vh] pr-2">
                        {images.map((img, index) => (
                            <div key={img.url} className="relative group aspect-square bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-700/50 opacity-0 animate-fade-in" style={{ animation: 'fadeIn 0.3s ease-out forwards', animationDelay: `${index * 50}ms` }} onClick={() => onImageClick(img.url)}>
                                <img src={img.url} alt={`OCR ${index + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); onImageRemove(index); }} className="bg-red-500 text-white rounded-lg p-1.5 hover:bg-red-600 shadow-xl transition-colors"><RemoveIcon /></button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                                    <span className="text-[10px] text-sky-400 font-black block text-center uppercase tracking-tighter">#{index + 1}</span>
                                </div>
                            </div>
                        ))}
                        <button onClick={handleFileSelectClick} className="flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl hover:bg-slate-800/50 transition-colors aspect-square">
                            <PlusIcon />
                        </button>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600/60">
                        <p className="text-sm font-bold uppercase tracking-widest italic">Trình nhập ảnh tối ưu</p>
                    </div>
                )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" multiple />
            <button onClick={onExtract} disabled={isLoading || images.length === 0} className="mt-8 w-full bg-emerald-600 text-white font-black py-6 px-4 rounded-3xl transition-all disabled:bg-slate-700/50 disabled:text-slate-600 hover:bg-emerald-500 active:scale-[0.97] shadow-2xl text-xl uppercase tracking-widest flex items-center justify-center">
                {isLoading ? 'ĐANG XỬ LÝ...' : `BẮT ĐẦU TRÍCH XUẤT (${images.length})`}
            </button>
            {error && <div className="mt-4 bg-red-950/40 border border-red-800 text-red-400 px-4 py-3 rounded-2xl text-sm text-center font-bold">{error}</div>}
        </div>
    );
};

interface ResultPanelProps {
    formattedTextForCopy: string;
    placeholder: string;
    isNotifying: boolean;
    onSaveAndNotify: () => void;
    hasResult: boolean;
}

const ResultPanel: React.FC<ResultPanelProps> = ({ formattedTextForCopy, placeholder, isNotifying, onSaveAndNotify, hasResult }) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const handleShare = async () => {
        if (navigator.share) {
            try { await navigator.share({ title: 'Dữ liệu OCR', text: formattedTextForCopy }); } catch (err) { console.error(err); }
        } else { handleBulkCopyToClipboard(); }
    };
    const handleBulkCopyToClipboard = () => {
        if (!formattedTextForCopy) return;
        navigator.clipboard.writeText(formattedTextForCopy).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); });
    };

    return (
        <div className="bg-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl h-full flex flex-col border border-slate-700/50">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h3 className="text-2xl font-black text-sky-400 flex items-center tracking-tight">
                    <span className="bg-sky-500 text-slate-950 rounded-xl w-8 h-8 flex items-center justify-center mr-4 text-sm font-black shadow-lg shadow-sky-500/20">2</span>
                    DỮ LIỆU TỔNG HỢP
                </h3>
                {hasResult && (
                     <div className="flex gap-2">
                        <button onClick={handleBulkCopyToClipboard} className="flex items-center bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-all text-xs border border-slate-600 active:scale-95 shadow-md">
                            {copySuccess ? <CheckIcon /> : <CopyIcon />}
                            <span className="ml-2">{copySuccess ? 'Đã chép!' : 'Chép'}</span>
                        </button>
                        <button onClick={handleShare} className="flex items-center bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-all text-xs border border-slate-600 active:scale-95 shadow-md">
                           <ShareIcon /> <span className="ml-2">Chia sẻ</span>
                        </button>
                    </div>
                )}
            </div>
            <div className="flex-grow bg-slate-900/60 rounded-2xl p-4 border border-slate-700/40">
                 <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-300 h-full overflow-y-auto max-h-[60vh] md:max-h-full">
                    {formattedTextForCopy || <span className="text-slate-600 italic">{placeholder}</span>}
                </pre>
            </div>
            <button onClick={onSaveAndNotify} disabled={isNotifying || !hasResult} className="mt-8 w-full bg-sky-600 text-white font-black py-5 px-4 rounded-3xl transition-all disabled:bg-slate-700/50 disabled:text-slate-600 hover:bg-sky-500 active:scale-[0.97] shadow-2xl text-lg uppercase tracking-widest flex items-center justify-center">
                {isNotifying ? 'ĐANG GỬI...' : 'GỬI LÊN CSDL'}
            </button>
        </div>
    );
};