import React, { useState, useEffect, useCallback } from 'react';

const TShirtRecolor = () => {
    const [originalImage] = useState("https://drive.google.com/file/d/1kGkquT85dbMU69bG6cS0K0cgzDM3aLmg/view?usp=sharing");
    const [previewImage, setPreviewImage] = useState('');
    const [color, setColor] = useState('#0080ff');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [serverStatus, setServerStatus] = useState('checking');

    // Check server status on component mount
    useEffect(() => {
        checkServerStatus();
    }, []);

    const checkServerStatus = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/health');
            const data = await response.json();
            setServerStatus('online');
            setMessage('Server connected successfully');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setServerStatus('offline');
            setMessage('❌ Server is not responding. Please make sure the backend is running on port 3000.');
        }
    };

    // Debounce function for real-time preview
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(null, args), delay);
        };
    };

    // Convert hex to RGB object
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };

    // Generate preview using Python backend
    const generatePreview = useCallback(debounce(async (colorHex) => {
        if (serverStatus !== 'online') {
            setMessage('❌ Server is not available. Please check if the backend is running.');
            return;
        }

        const rgb = hexToRgb(colorHex);
        if (!rgb) return;

        setIsLoading(true);
        setMessage('Generating preview...');

        try {
            const response = await fetch('http://localhost:3000/api/recolor-tshirt-preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageUrl: originalImage,
                    color: rgb
                })
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            if (data.success) {
                setPreviewImage(`data:image/png;base64,${data.base64_image}`);
                setMessage('Preview updated successfully');
                setTimeout(() => setMessage(''), 2000);
            } else {
                throw new Error(data.error || 'Unknown error from server');
            }
        } catch (error) {
            console.error('Preview generation error:', error);
            setMessage(`❌ Failed to generate preview: ${error.message}`);
            setPreviewImage('');
        } finally {
            setIsLoading(false);
        }
    }, 500), [originalImage, serverStatus]);

    // Save final image
    const saveImage = async () => {
        if (serverStatus !== 'online') {
            setMessage('❌ Server is not available. Please check if the backend is running.');
            return;
        }

        const rgb = hexToRgb(color);
        if (!rgb) return;

        setIsSaving(true);
        setMessage('Saving image...');

        try {
            const response = await fetch('http://localhost:3000/api/recolor-tshirt-save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageUrl: originalImage,
                    color: rgb
                })
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            if (data.success) {
                setMessage('✅ Image saved successfully!');
            } else {
                throw new Error(data.error || 'Unknown error from server');
            }
        } catch (error) {
            console.error('Save error:', error);
            setMessage(`❌ Save failed: ${error.message}`);
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(''), 5000);
        }
    };

    // Handle color change
    const handleColorChange = (e) => {
        const newColor = e.target.value;
        setColor(newColor);
        if (serverStatus === 'online') {
            generatePreview(newColor);
        }
    };

    // Generate initial preview when server comes online
    useEffect(() => {
        if (serverStatus === 'online') {
            generatePreview(color);
        }
    }, [serverStatus, color, generatePreview]);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
                🎨 T-Shirt Recolor Tool
            </h1>

            {/* Server Status Indicator */}
            <div className={`mb-4 p-3 rounded-lg text-center ${
                serverStatus === 'online' ? 'bg-green-100 text-green-800' : 
                serverStatus === 'offline' ? 'bg-red-100 text-red-800' : 
                'bg-yellow-100 text-yellow-800'
            }`}>
                {serverStatus === 'online' && '✅ Server is connected'}
                {serverStatus === 'offline' && '❌ Server is offline - Please start the backend server'}
                {serverStatus === 'checking' && '🔄 Checking server status...'}
            </div>
            
            {/* Controls Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8 p-6 bg-gray-50 rounded-xl">
                {/* Color Picker */}
                <div className="flex-1">
                    <label htmlFor="colorPicker" className="block text-sm font-semibold text-gray-700 mb-2">
                        Choose T-Shirt Color:
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="color"
                            id="colorPicker"
                            value={color}
                            onChange={handleColorChange}
                            disabled={isLoading || serverStatus !== 'online'}
                            className="w-16 h-16 rounded-lg cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="font-mono text-lg text-gray-600">
                            {color}
                        </span>
                        <div 
                            className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm"
                            style={{ backgroundColor: color }}
                        ></div>
                    </div>
                </div>

                {/* Save Button */}
                <button 
                    onClick={saveImage}
                    disabled={isSaving || isLoading || serverStatus !== 'online'}
                    className={`
                        px-6 py-3 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${isSaving || isLoading || serverStatus !== 'online'
                            ? 'bg-gray-500' 
                            : 'bg-green-500 hover:bg-green-600'
                        }
                    `}
                >
                    {isSaving ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </span>
                    ) : (
                        '💾 Save Image'
                    )}
                </button>
            </div>

            {/* Message Display */}
            {message && (
                <div className={`
                    mb-6 p-4 rounded-lg text-center font-medium
                    ${message.includes('✅') 
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : message.includes('❌') 
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }
                `}>
                    {message}
                </div>
            )}

            {/* Images Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Original T-Shirt */}
                <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">
                        Original T-Shirt
                    </h3>
                    <div className="bg-white p-4 rounded-xl shadow-lg">
                        <img 
                            src={originalImage} 
                            alt="Original T-Shirt" 
                            className="w-full h-auto rounded-lg"
                        />
                    </div>
                </div>

                {/* Recolored Preview */}
                <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">
                        Recolored Preview
                    </h3>
                    <div className="bg-white p-4 rounded-xl shadow-lg min-h-[300px] flex items-center justify-center">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-3 text-gray-600">
                                <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Generating preview...</span>
                            </div>
                        ) : previewImage ? (
                            <img 
                                src={previewImage} 
                                alt="Recolored T-Shirt" 
                                className="w-full h-auto rounded-lg"
                            />
                        ) : serverStatus !== 'online' ? (
                            <div className="text-gray-500 text-center">
                                <div className="text-red-500 mb-2">❌</div>
                                <div>Server unavailable</div>
                                <div className="text-sm mt-2">Please start the backend server</div>
                            </div>
                        ) : (
                            <div className="text-gray-500">
                                Select a color to see preview
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Debug Info */}
            <div className="mt-8 p-4 bg-gray-100 rounded-lg">
                <h4 className="font-semibold mb-2">Debug Information:</h4>
                <div className="text-sm font-mono">
                    <div>Server Status: <span className={serverStatus === 'online' ? 'text-green-600' : 'text-red-600'}>{serverStatus}</span></div>
                    <div>Current Color: {color}</div>
                    <div>Preview Ready: {previewImage ? 'Yes' : 'No'}</div>
                </div>
            </div>
        </div>
    );
};

export default TShirtRecolor;