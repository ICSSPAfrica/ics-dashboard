import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Upload, X, File, Image, Video, Music, Camera, Mic, Link as LinkIcon, Plus } from 'lucide-react';
import { FormQuestion } from '../../form-creation-wizard/types';
import { BaseQuestionRenderer } from './BaseQuestionRenderer';
import { useForm } from '@/contexts/FormContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { useAuth } from '@/contexts/AuthContext';
import { generateMediaFileName, createMediaNamingData, getMediaTypeFromExtension } from '@/lib/mediaNamingConvention';
import { apiClient } from '@/lib/api/client';

function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = apiClient.getBaseUrl().replace(/\/api\/v1\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

interface MediaUploadQuestionRendererProps {
  question: FormQuestion;
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  locationData?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
}

export function MediaUploadQuestionRenderer({ 
  question, 
  value = [], 
  onChange, 
  disabled = false,
  locationData
}: MediaUploadQuestionRendererProps) {
  const { projectId } = useParams();
  const { currentForm, uploadMediaFile } = useForm();
  const { user } = useAuth();
  
  // For public forms, useProjects might not be available
  let projects: any[] = [];
  let isPublicForm = false;
  try {
    const projectsContext = useProjects();
    projects = projectsContext.projects || [];
  } catch (error) {
    // useProjects not available (e.g., public forms), continue with empty projects
    isPublicForm = true;
    console.log('📝 MediaUploadQuestionRenderer: Projects context not available, running in public form mode');
  }
  const [dragActive, setDragActive] = useState(false);
  const [showCaptureOptions, setShowCaptureOptions] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [linkInput, setLinkInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Generate proper file name with naming convention
  const generateProperFileName = (originalFile: File, mediaType: 'image' | 'video' | 'audio' | 'file'): File => {
    if (!projectId || !currentForm) {
      return originalFile; // Return original if we don't have context
    }

    const project = projects.find(p => p.id === projectId);
    if (!project) {
      return originalFile; // Return original if project not found
    }

    try {
      // Create naming data
      const namingData = createMediaNamingData(
        project,
        currentForm,
        originalFile.name,
        mediaType
      );

      // Generate new file name
      const newFileName = generateMediaFileName(namingData);

      // Create new File object with the new name
      return new (window as any).File([originalFile], newFileName, {
        type: originalFile.type,
        lastModified: originalFile.lastModified
      });
    } catch (error) {
      console.error('Error generating file name:', error);
      return originalFile; // Return original on error
    }
  };

  const getMediaTypeConfig = () => {
    switch (question.type) {
      case 'IMAGE_UPLOAD':
        return {
          icon: Image,
          title: 'Image Upload',
          acceptedTypes: 'image/*',
          maxFiles: question.maxFiles || 10,
          maxSize: question.maxFileSize || 5 * 1024 * 1024, // 5MB
          formats: question.allowedFormats || ['jpg', 'jpeg', 'png', 'gif', 'webp']
        };
      case 'VIDEO_UPLOAD':
        return {
          icon: Video,
          title: 'Video Upload',
          acceptedTypes: 'video/*',
          maxFiles: question.maxFiles || 4,
          maxSize: question.maxFileSize || 100 * 1024 * 1024, // 100MB
          formats: question.allowedFormats || ['mp4', 'avi', 'mov', 'wmv', 'webm']
        };
      case 'AUDIO_UPLOAD':
        return {
          icon: Music,
          title: 'Audio Upload',
          acceptedTypes: 'audio/*',
          maxFiles: question.maxFiles || 3,
          maxSize: question.maxFileSize || 50 * 1024 * 1024, // 50MB
          formats: question.allowedFormats || ['mp3', 'wav', 'aac', 'ogg', 'm4a']
        };
      case 'FILE_UPLOAD':
        return {
          icon: File,
          title: 'File Upload',
          acceptedTypes: '*/*',
          maxFiles: question.maxFiles || 5,
          maxSize: question.maxFileSize || 25 * 1024 * 1024, // 25MB
          formats: question.allowedFormats || ['pdf', 'doc', 'docx', 'txt', 'rtf']
        };
      default:
        return {
          icon: File,
          title: 'File Upload',
          acceptedTypes: '*/*',
          maxFiles: 1,
          maxSize: 10 * 1024 * 1024,
          formats: []
        };
    }
  };

  const config = getMediaTypeConfig();
  const IconComponent = config.icon;

  // Check if device supports media capture
  const supportsMediaCapture = () => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  };

  // Check if device has camera
  const hasCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch {
      return false;
    }
  };

  // Check if device has microphone
  const hasMicrophone = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'audioinput');
    } catch {
      return false;
    }
  };

  // Start camera capture for images
  const startImageCapture = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
      setIsCapturing(false);
    }
  };

  // Start camera capture for videos
  const startVideoCapture = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera/microphone:', error);
      alert('Unable to access camera/microphone. Please check permissions.');
      setIsCapturing(false);
    }
  };

  // Start video recording
  const startVideoRecording = async () => {
    if (!streamRef.current) return;

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
        const originalFile = new (window as any).File([blob], `recorded-video-${Date.now()}.webm`, { type: 'video/webm' });
        const renamedFile = generateProperFileName(originalFile, 'video');
        
        // Store with metadata if we have context
        if (projectId && currentForm && user) {
          const project = projects.find(p => p.id === projectId);
          if (project) {
            await uploadMediaFile(
              renamedFile,
              project,
              currentForm,
              question.id,
              question.title,
              `${user.firstName} ${user.lastName}`,
              'video',
              locationData
            );
          }
        }
        
        handleFileSelect([renamedFile] as any);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting video recording:', error);
      alert('Unable to start video recording.');
    }
  };

  // Stop video recording
  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Start audio recording
  const startAudioRecording = async () => {
    if (!streamRef.current) return;

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const originalFile = new (window as any).File([blob], `recorded-audio-${Date.now()}.webm`, { type: 'audio/webm' });
        const renamedFile = generateProperFileName(originalFile, 'audio');
        
        // Store with metadata if we have context
        if (projectId && currentForm && user) {
          const project = projects.find(p => p.id === projectId);
          if (project) {
            await uploadMediaFile(
              renamedFile,
              project,
              currentForm,
              question.id,
              question.title,
              `${user.firstName} ${user.lastName}`,
              'audio',
              locationData
            );
          }
        }
        
        handleFileSelect([renamedFile] as any);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      alert('Unable to start audio recording.');
    }
  };

  // Stop audio recording
  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Start audio capture
  const startAudioCapture = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check permissions.');
      setIsCapturing(false);
    }
  };

  // Capture image from camera
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        const originalFile = new (window as any).File([blob], `captured-image-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const renamedFile = generateProperFileName(originalFile, 'image');
        
        // Store with metadata if we have context
        if (projectId && currentForm && user) {
          const project = projects.find(p => p.id === projectId);
          if (project) {
            await uploadMediaFile(
              renamedFile,
              project,
              currentForm,
              question.id,
              question.title,
              `${user.firstName} ${user.lastName}`,
              'image',
              locationData
            );
          }
        }
        
        handleFileSelect([renamedFile] as any);
      }
    }, 'image/jpeg', 0.8);

    stopCapture();
  };

  // Stop media capture
  const stopCapture = () => {
    // Stop recording if active
    if (isRecording) {
      if (question.type === 'VIDEO_UPLOAD') {
        stopVideoRecording();
      } else if (question.type === 'AUDIO_UPLOAD') {
        stopAudioRecording();
      }
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Clear recording timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    setIsCapturing(false);
    setIsRecording(false);
    setRecordingTime(0);
    setShowCaptureOptions(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !onChange) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      // Check file size
      if (file.size > config.maxSize) {
        alert(`File ${file.name} is too large. Maximum size is ${formatFileSize(config.maxSize)}`);
        return false;
      }

      // Check file count
      if (value.length + 1 > config.maxFiles) {
        alert(`Maximum ${config.maxFiles} files allowed`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      try {
        // Store files with metadata
        const storedFileData = [];
        for (const file of validFiles) {
          const mediaType = getMediaTypeFromExtension(file.name);
          const renamedFile = generateProperFileName(file, mediaType);
          
          // Store with metadata if we have context (authenticated forms)
          if (projectId && currentForm && user && !isPublicForm) {
            const project = projects.find(p => p.id === projectId);
            if (project) {
              console.log('📝 Uploading media file to server...');
              const uploadedFile = await uploadMediaFile(
                renamedFile,
                project,
                currentForm,
                question.id,
                question.title,
                `${user.firstName} ${user.lastName}`,
                mediaType,
                locationData
              );
              
              // Store the file data with URL for form response
              storedFileData.push({
                id: uploadedFile.id,
                name: uploadedFile.metadata.fileName,
                originalName: uploadedFile.metadata.originalFileName,
                size: uploadedFile.metadata.fileSize,
                type: uploadedFile.metadata.fileType,
                url: uploadedFile.url,
                filePath: uploadedFile.filePath,
                mediaType: uploadedFile.metadata.mediaType,
                uploadedAt: uploadedFile.metadata.uploadedAt
              });
              console.log('✅ Media file uploaded, URL:', uploadedFile.url);
            } else {
              // Fallback if no project found
              storedFileData.push({
                name: renamedFile.name,
                originalName: file.name,
                size: file.size,
                type: file.type,
                mediaType,
                file: renamedFile // Keep file object for local storage
              });
            }
          } else {
            // Public form - store file data without server upload
            console.log('📝 Public form: storing file data locally');
            storedFileData.push({
              name: renamedFile.name,
              originalName: file.name,
              size: file.size,
              type: file.type,
              mediaType,
              file: renamedFile // Keep file object for form submission
            });
          }
        }

        const newFiles = [...value, ...storedFileData];
        onChange(newFiles);
      } catch (error) {
        console.error('Error storing media files:', error);
        // Fallback to basic file data storage
        const fileData = validFiles.map(file => {
          const mediaType = getMediaTypeFromExtension(file.name);
          const renamedFile = generateProperFileName(file, mediaType);
          return {
            name: renamedFile.name,
            originalName: file.name,
            size: file.size,
            type: file.type,
            mediaType,
            file: renamedFile,
            uploadError: true
          };
        });
        const newFiles = [...value, ...fileData];
        onChange(newFiles);
      }
    }
  };

  const removeFile = (index: number) => {
    if (!onChange) return;
    const newFiles = value.filter((_: any, i: number) => i !== index);
    onChange(newFiles);
  };

  // Validate URL
  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Handle adding a link
  const handleAddLink = () => {
    if (!onChange || !linkInput.trim()) return;

    const trimmedLink = linkInput.trim();

    // Validate URL
    if (!isValidUrl(trimmedLink)) {
      alert('Please enter a valid URL (must start with http:// or https://)');
      return;
    }

    // Check file count
    if (value.length + 1 > config.maxFiles) {
      alert(`Maximum ${config.maxFiles} files/links allowed`);
      return;
    }

    // Create link object
    const linkData = {
      type: 'link',
      url: trimmedLink,
      label: trimmedLink, // Default label is the URL
      mediaType: getMediaTypeFromExtension(trimmedLink) || 'file',
      addedAt: new Date().toISOString()
    };

    const newFiles = [...value, linkData];
    onChange(newFiles);
    setLinkInput(''); // Clear input after adding, but keep the field visible
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  return (
    <BaseQuestionRenderer question={question}>
      <div className="space-y-4">
        {/* Capture Options for Image/Video/Audio */}
        {supportsMediaCapture() && (question.type === 'IMAGE_UPLOAD' || question.type === 'VIDEO_UPLOAD' || question.type === 'AUDIO_UPLOAD') && (
          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Capture from Device
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCaptureOptions(!showCaptureOptions)}
                  disabled={disabled}
                >
                  {showCaptureOptions ? 'Hide' : 'Show'} Options
                </Button>
              </div>
              
              {showCaptureOptions && (
                <div className="space-y-3">
                  {question.type === 'IMAGE_UPLOAD' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={startImageCapture}
                      disabled={disabled || isCapturing}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Capture Photo
                    </Button>
                  )}
                  
                  {question.type === 'VIDEO_UPLOAD' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={startVideoCapture}
                      disabled={disabled || isCapturing}
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Record Video
                    </Button>
                  )}
                  
                  {question.type === 'AUDIO_UPLOAD' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={startAudioCapture}
                      disabled={disabled || isCapturing}
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Record Audio
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Camera/Media Capture Interface */}
        {isCapturing && (
          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {question.type === 'IMAGE_UPLOAD' ? 'Take Photo' : 
                   question.type === 'VIDEO_UPLOAD' ? 'Record Video' : 'Record Audio'}
                </h3>
                <p className="text-sm text-gray-600">
                  {question.type === 'IMAGE_UPLOAD' ? 'Position your camera and click capture' :
                   question.type === 'VIDEO_UPLOAD' ? (isRecording ? 'Recording... Click stop when done' : 'Click start to begin recording') :
                   question.type === 'AUDIO_UPLOAD' ? (isRecording ? 'Recording audio... Click stop when done' : 'Click start to begin recording') :
                   'Position your camera and click capture'}
                </p>
                {isRecording && (
                  <div className="mt-2">
                    <Badge variant="destructive" className="text-sm">
                      Recording: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </Badge>
                  </div>
                )}
              </div>
              
              {(question.type === 'IMAGE_UPLOAD' || question.type === 'VIDEO_UPLOAD') && (
                <div className="relative mb-4">
                  <video
                    ref={videoRef}
                    className="w-full max-w-md mx-auto rounded-lg border border-gray-300"
                    autoPlay
                    muted
                    playsInline
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                </div>
              )}
              
              <div className="flex justify-center space-x-3">
                {question.type === 'IMAGE_UPLOAD' && (
                  <Button
                    type="button"
                    onClick={captureImage}
                    disabled={disabled}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture Photo
                  </Button>
                )}
                
                {question.type === 'VIDEO_UPLOAD' && !isRecording && (
                  <Button
                    type="button"
                    onClick={startVideoRecording}
                    disabled={disabled}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                )}
                
                {question.type === 'VIDEO_UPLOAD' && isRecording && (
                  <Button
                    type="button"
                    onClick={stopVideoRecording}
                    disabled={disabled}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Stop Recording
                  </Button>
                )}
                
                {question.type === 'AUDIO_UPLOAD' && !isRecording && (
                  <Button
                    type="button"
                    onClick={startAudioRecording}
                    disabled={disabled}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                )}
                
                {question.type === 'AUDIO_UPLOAD' && isRecording && (
                  <Button
                    type="button"
                    onClick={stopAudioRecording}
                    disabled={disabled}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Stop Recording
                  </Button>
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCapture}
                  disabled={disabled}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Area */}
        <Card 
          className={`border-2 border-dashed transition-colors ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <CardContent className="p-6">
            <div className="text-center">
              <IconComponent className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {config.title}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Drag and drop files here, or click to browse
              </p>
              
              <div className="space-y-2 text-xs text-gray-500">
                <p>Maximum {config.maxFiles} file{config.maxFiles !== 1 ? 's' : ''} or link{config.maxFiles !== 1 ? 's' : ''}</p>
                <p>Maximum size: {formatFileSize(config.maxSize)} per file</p>
                {config.formats.length > 0 && (
                  <p>Accepted formats: {config.formats.join(', ')}</p>
                )}
                {isPublicForm ? (
                  <p className="text-amber-600 font-medium">
                    📝 Public form: Files will be stored temporarily for submission
                  </p>
                ) : (
                  <p className="text-blue-600 font-medium">
                    📝 Files will be automatically renamed with project and form prefixes
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = (question as any).allowMultiple !== false;
                  input.accept = config.acceptedTypes;
                  input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
                  input.click();
                }}
                disabled={disabled}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Files
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Link Input Section - Always available for media upload questions */}
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <h4 className="text-sm font-medium text-gray-900">Add Media Link</h4>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com/media/file.jpg"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLink();
                    }
                  }}
                  disabled={disabled}
                  className="flex-1 w-full sm:w-auto"
                />
                <Button
                  type="button"
                  onClick={handleAddLink}
                  disabled={disabled || !linkInput.trim()}
                  className="w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Enter a URL to a media file (must start with http:// or https://)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* File and Link List */}
        {value && value.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">
              Selected Files & Links ({value.length}/{config.maxFiles})
            </h4>
            {value.map((fileData: any, index: number) => {
              // Check if this is a link
              const isLink = fileData.type === 'link';
              
              if (isLink) {
                // Render link item
                const linkUrl = fileData.url || '';
                const linkLabel = fileData.label || linkUrl;
                
                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                      <LinkIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 break-words">{linkLabel}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1 text-xs text-gray-500">
                          <a 
                            href={linkUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline break-all sm:break-words"
                            title={linkUrl}
                          >
                            {linkUrl}
                          </a>
                          <Badge variant="outline" className="text-xs w-fit">Link</Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={disabled}
                      className="flex-shrink-0 self-end sm:self-center"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              }
              
              // Handle both File objects (legacy) and file data objects (new)
              const fileName = fileData.name || fileData.fileName || 'Unknown file';
              const fileSize = fileData.size || fileData.fileSize || 0;
              const fileUrl = fileData.url ? resolveMediaUrl(fileData.url) : undefined;
              const hasUploadError = fileData.uploadError;
              
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <IconComponent className="w-5 h-5 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatFileSize(fileSize)}</span>
                        {fileUrl && (
                          <>
                            <span>•</span>
                            <a 
                              href={fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline truncate max-w-[200px]"
                              title={fileUrl}
                            >
                              View File
                            </a>
                          </>
                        )}
                        {hasUploadError && (
                          <>
                            <span>•</span>
                            <span className="text-red-500">Upload failed</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={disabled}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Validation Messages */}
        {question.validationRules?.map((rule, index) => (
          <div key={index} className="text-xs text-gray-500">
            {rule.message}
          </div>
        ))}
      </div>
    </BaseQuestionRenderer>
  );
}

