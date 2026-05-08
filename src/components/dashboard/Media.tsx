import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Image, Video, Upload, Download, Eye, Trash2, Plus, Play, FileImage, Search, Filter, Calendar, User, File, FileVideo, FileAudio, Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formsApi } from '@/lib/api/formsApi';
import { apiClient } from '@/lib/api/client';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/** Turn a potentially-relative media URL into an absolute one pointing at the API server. */
function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  // Relative URL like /uploads/media/file.jpg — prepend the API base (strip /api/v1 suffix)
  const base = apiClient.getBaseUrl().replace(/\/api\/v1\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

interface MediaFile {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  url: string;
  uploadedAt: string;
  uploadedBy?: string;
  metadata: {
    mediaType: 'image' | 'video' | 'audio' | 'file' | 'link';
    tags?: string[];
    description?: string;
    location?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      address?: string;
    };
    formId?: string;
    formName?: string;
    questionId?: string;
    questionTitle?: string;
    questionType?: string;
    questionOrder?: number;
    projectName?: string;
    projectId?: string;
    country?: string;
    uploadedVia?: string; // 'direct-upload' | 'external-link' | etc.
  };
  form?: {
    id: string;
    title: string;
    projectId: string;
  } | null;
  question?: {
    id: string;
    title: string;
    type: string;
    order: number;
  };
}


export function Media() {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaFile[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [selectedQuestionType, setSelectedQuestionType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const tagsRef = useRef<HTMLInputElement>(null);
  const linkUrlRef = useRef<HTMLInputElement>(null);
  const linkTitleRef = useRef<HTMLInputElement>(null);
  const linkDescRef = useRef<HTMLTextAreaElement>(null);
  const linkTagsRef = useRef<HTMLInputElement>(null);

  // Load media from database
  useEffect(() => {
    if (projectId) {
      loadMediaFiles();
    }
  }, [projectId]);

  // Filter media based on search, type, form, and question type
  useEffect(() => {
    let filtered = media;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.metadata.mediaType === selectedType);
    }

    // Filter by form
    if (selectedForm !== 'all') {
      filtered = filtered.filter(item => item.metadata.formName === selectedForm);
    }

    // Filter by question type
    if (selectedQuestionType !== 'all') {
      filtered = filtered.filter(item => item.metadata.questionType === selectedQuestionType);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.metadata.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.metadata.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.metadata.formName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.metadata.questionTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.metadata.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredMedia(filtered);
  }, [media, selectedType, selectedForm, selectedQuestionType, searchQuery]);

  const loadMediaFiles = async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      console.log('🔍 Loading media files for project:', projectId);
      const mediaFiles = await formsApi.getProjectMediaFiles(projectId);
      console.log('📁 Media files loaded:', mediaFiles);
      setMedia(mediaFiles);
    } catch (error) {
      console.error('❌ Error loading media files:', error);
      toast({
        title: "Error",
        description: "Failed to load media files",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetUploadDialog = () => {
    setUploadTab('file');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (descRef.current) descRef.current.value = '';
    if (tagsRef.current) tagsRef.current.value = '';
    if (linkUrlRef.current) linkUrlRef.current.value = '';
    if (linkTitleRef.current) linkTitleRef.current.value = '';
    if (linkDescRef.current) linkDescRef.current.value = '';
    if (linkTagsRef.current) linkTagsRef.current.value = '';
  };

  // Upload handler - Note: This would need to be integrated with form uploads
  const handleUpload = async () => {
    const fileInput = fileInputRef.current;
    const desc = descRef.current?.value || '';
    const tags = tagsRef.current?.value?.split(',').map(t => t.trim()).filter(Boolean) || [];
    
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID not found",
        variant: "destructive",
      });
      return;
    }

    const file = fileInput.files[0];
    
    try {
      toast({
        title: "Uploading...",
        description: "Please wait while your file is being uploaded",
        variant: "default",
      });

      console.log('📁 Uploading file:', file.name, 'to project:', projectId);
      
      const result = await formsApi.uploadDirectMediaFile(
        projectId,
        file,
        desc || undefined,
        tags.length > 0 ? tags.join(',') : undefined
      );

      console.log('✅ Upload successful:', result);

      toast({
        title: "Success",
        description: "Media file uploaded successfully",
        variant: "default",
      });

      // Reload media files
      await loadMediaFiles();
      
      setUploadDialogOpen(false);
      resetUploadDialog();
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload media file",
        variant: "destructive",
      });
    }
  };

  const handleAddLink = async () => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID not found",
        variant: "destructive",
      });
      return;
    }

    const url = linkUrlRef.current?.value?.trim() || '';
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    const title = linkTitleRef.current?.value?.trim() || undefined;
    const description = linkDescRef.current?.value?.trim() || undefined;
    const tagsRaw = linkTagsRef.current?.value?.trim() || '';

    try {
      toast({
        title: "Saving...",
        description: "Adding link to project media",
        variant: "default",
      });

      await formsApi.addProjectMediaLink(projectId, {
        url,
        title,
        description,
        tags: tagsRaw || undefined,
      });

      toast({
        title: "Success",
        description: "Link added to media library",
        variant: "default",
      });

      await loadMediaFiles();
      setUploadDialogOpen(false);
      resetUploadDialog();
    } catch (error) {
      console.error('❌ Add link failed:', error);
      toast({
        title: "Failed",
        description: error instanceof Error ? error.message : "Could not add link",
        variant: "destructive",
      });
    }
  };

  // View handler
  const handleView = (item: MediaFile) => {
    setSelectedMedia(item);
    setViewDialogOpen(true);
  };

  // Download / open handler
  const handleDownload = async (item: MediaFile) => {
    if (item.metadata.mediaType === 'link' || item.metadata.uploadedVia === 'external-link') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    const resolved = resolveMediaUrl(item.url);
    try {
      // Fetch as blob so the browser doesn't navigate away and the filename sticks
      const resp = await fetch(resolved);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = item.originalName;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: let the browser handle it directly
      window.open(resolved, '_blank', 'noopener,noreferrer');
    }
  };

  // Delete handler
  const handleDelete = async (item: MediaFile) => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID not found",
        variant: "destructive",
      });
      return;
    }

    if (item.id.startsWith('response-')) {
      toast({
        title: "Not supported",
        description: "Items embedded only in form responses cannot be deleted from this screen yet.",
        variant: "destructive",
      });
      return;
    }

    if (confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      try {
        await formsApi.deleteMediaFile(projectId, item.id);
        await loadMediaFiles();
        toast({
          title: "Success",
          description: "File deleted successfully",
        });
      } catch (error) {
        console.error('Error deleting file:', error);
        toast({
          title: "Error",
          description: "Failed to delete file",
          variant: "destructive",
        });
      }
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <FileImage className="h-4 w-4 text-blue-500" />;
      case 'video':
        return <FileVideo className="h-4 w-4 text-red-500" />;
      case 'audio':
        return <FileAudio className="h-4 w-4 text-purple-500" />;
      case 'link':
        return <Link2 className="h-4 w-4 text-amber-600" />;
      case 'file':
        return <File className="h-4 w-4 text-green-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get unique forms and question types for filters
  const uniqueForms = Array.from(new Set(media.map(item => item.metadata.formName).filter((name): name is string => Boolean(name))));
  const uniqueQuestionTypes = Array.from(new Set(media.map(item => item.metadata.questionType).filter((type): type is string => Boolean(type))));

  const totalSize = filteredMedia.reduce((sum, item) => {
    return sum + item.fileSize;
  }, 0);

  const isProjectLibraryOnly = (item: MediaFile) =>
    item.metadata.uploadedVia === 'direct-upload' || item.metadata.uploadedVia === 'external-link';

  const sourceLabel = (item: MediaFile) => {
    if (item.metadata.uploadedVia === 'direct-upload') return 'Direct upload';
    if (item.metadata.uploadedVia === 'external-link') return 'Link';
    return 'Form response';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Media Library</h1>
          <p className="text-muted-foreground">Manage project images, videos, and documents</p>
        </div>
        <Dialog
          open={uploadDialogOpen}
          onOpenChange={(open) => {
            setUploadDialogOpen(open);
            if (!open) resetUploadDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add media
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add media</DialogTitle>
              <DialogDescription>
                Upload a file or add an external link. Everything is stored under this project.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={uploadTab} onValueChange={(v) => setUploadTab(v as 'file' | 'link')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">Upload file</TabsTrigger>
                <TabsTrigger value="link">Add link</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="file">File</Label>
                  <Input 
                    id="file" 
                    type="file" 
                    accept="image/*,video/*,.pdf,.doc,.docx" 
                    className="cursor-pointer"
                    ref={fileInputRef}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Enter media description..." 
                    className="resize-none"
                    ref={descRef}
                  />
                </div>
                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input 
                    id="tags" 
                    placeholder="e.g., training, children, rights" 
                    ref={tagsRef}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpload}>
                    Upload
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="link" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="link-url">URL</Label>
                  <Input
                    id="link-url"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    ref={linkUrlRef}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="link-title">Title (optional)</Label>
                  <Input
                    id="link-title"
                    placeholder="Short label for this link"
                    ref={linkTitleRef}
                  />
                </div>
                <div>
                  <Label htmlFor="link-description">Description</Label>
                  <Textarea
                    id="link-description"
                    placeholder="What is this link for?"
                    className="resize-none"
                    ref={linkDescRef}
                  />
                </div>
                <div>
                  <Label htmlFor="link-tags">Tags (comma-separated)</Label>
                  <Input
                    id="link-tags"
                    placeholder="e.g., training, partner-site"
                    ref={linkTagsRef}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddLink}>
                    Save link
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredMedia.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredMedia.filter(item => item.metadata.mediaType === 'image').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Videos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredMedia.filter(item => item.metadata.mediaType === 'video').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredMedia.filter(item => item.metadata.mediaType === 'link').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(totalSize)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <Input
            placeholder="Search media files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="file">Files</SelectItem>
            <SelectItem value="link">Links</SelectItem>
          </SelectContent>
        </Select>
        {uniqueForms.length > 0 && (
          <Select value={selectedForm} onValueChange={setSelectedForm}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Forms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Forms</SelectItem>
              {uniqueForms.map(form => (
                <SelectItem key={form} value={form}>{form}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {uniqueQuestionTypes.length > 0 && (
          <Select value={selectedQuestionType} onValueChange={setSelectedQuestionType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Question Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Question Types</SelectItem>
              {uniqueQuestionTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Media Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>Media Files</CardTitle>
          <CardDescription>
            {filteredMedia.length} media file{filteredMedia.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading media files...</p>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="text-center py-8">
              <FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Media Files</h3>
              <p className="text-sm text-muted-foreground">
                No media files found for this project. Upload files through form responses to see them here.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Type</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMedia.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center">
                          {getMediaIcon(item.metadata?.mediaType || 'file')}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {item.metadata?.mediaType || 'file'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium truncate max-w-[200px]" title={item.originalName}>
                            {item.originalName}
                          </div>
                          {item.metadata.mediaType === 'link' && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.url}>
                              {item.url}
                            </div>
                          )}
                          {item.metadata.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.metadata.description}>
                              {item.metadata.description}
                            </div>
                          )}
                          {item.metadata.tags && item.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.metadata.tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {item.metadata.tags.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{item.metadata.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {isProjectLibraryOnly(item) ? (
                            <div className="text-sm text-muted-foreground">N/A</div>
                          ) : (
                            <>
                              {item.metadata.formName && (
                                <div className="text-sm font-medium">{item.metadata.formName}</div>
                              )}
                              {item.metadata.projectName && (
                                <div className="text-xs text-muted-foreground">{item.metadata.projectName}</div>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {isProjectLibraryOnly(item) ? (
                            <div className="text-sm text-muted-foreground">N/A</div>
                          ) : (
                            <>
                              {item.metadata.questionTitle && (
                                <div className="text-sm truncate max-w-[150px]" title={item.metadata.questionTitle}>
                                  {item.metadata.questionTitle}
                                </div>
                              )}
                              {item.metadata.questionType && (
                                <div className="text-xs text-muted-foreground">{item.metadata.questionType}</div>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {item.fileSize > 0 ? formatFileSize(item.fileSize) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{new Date(item.uploadedAt).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.uploadedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.uploadedBy || 'Unknown'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isProjectLibraryOnly(item) ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {sourceLabel(item)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleView(item)}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDownload(item)}
                            title={item.metadata.mediaType === 'link' ? 'Open link' : 'Download'}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(item)}
                            title="Delete"
                            disabled={item.id.startsWith('response-')}
                            className="text-red-600 hover:text-red-700 disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog/Modal */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedMedia && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{selectedMedia.originalName}</DialogTitle>
                {selectedMedia.metadata.description && (
                  <DialogDescription>{selectedMedia.metadata.description}</DialogDescription>
                )}
              </DialogHeader>
              {selectedMedia.metadata.mediaType === 'link' && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="text-sm break-all">{selectedMedia.url}</p>
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedMedia.url} target="_blank" rel="noopener noreferrer">
                      Open in new tab
                    </a>
                  </Button>
                </div>
              )}
              {selectedMedia.metadata.mediaType === 'image' && (
                <img src={resolveMediaUrl(selectedMedia.url)} alt={selectedMedia.originalName} className="w-full max-h-[400px] object-contain rounded" />
              )}
              {selectedMedia.metadata.mediaType === 'video' && (
                <video src={resolveMediaUrl(selectedMedia.url)} controls className="w-full max-h-[400px] rounded" />
              )}
              {selectedMedia.metadata.mediaType === 'audio' && (
                <audio src={resolveMediaUrl(selectedMedia.url)} controls className="w-full" />
              )}
              {(selectedMedia.metadata.mediaType === 'file') && (
                <div className="text-center py-8">
                  <File className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                  <button
                    onClick={() => handleDownload(selectedMedia)}
                    className="text-blue-600 underline cursor-pointer"
                  >
                    Download {selectedMedia.originalName}
                  </button>
                </div>
              )}
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>File Size:</strong> {selectedMedia.fileSize > 0 ? formatFileSize(selectedMedia.fileSize) : '—'}</p>
                <p><strong>Uploaded:</strong> {new Date(selectedMedia.uploadedAt).toLocaleString()}</p>
                {selectedMedia.uploadedBy && <p><strong>Uploaded by:</strong> {selectedMedia.uploadedBy}</p>}
                {selectedMedia.metadata.formName && <p><strong>From Form:</strong> {selectedMedia.metadata.formName}</p>}
                {selectedMedia.metadata.questionTitle && <p><strong>Question:</strong> {selectedMedia.metadata.questionTitle}</p>}
                {selectedMedia.metadata.questionType && <p><strong>Question Type:</strong> {selectedMedia.metadata.questionType}</p>}
                {selectedMedia.metadata.projectName && <p><strong>Project:</strong> {selectedMedia.metadata.projectName}</p>}
                {selectedMedia.metadata.country && <p><strong>Country:</strong> {selectedMedia.metadata.country}</p>}
                {selectedMedia.metadata.location && (
                  <div>
                    <strong>Location:</strong>
                    <p className="text-xs">
                      {selectedMedia.metadata.location.latitude}, {selectedMedia.metadata.location.longitude}
                      {selectedMedia.metadata.location.address && ` (${selectedMedia.metadata.location.address})`}
                    </p>
                  </div>
                )}
                {selectedMedia.metadata.tags && selectedMedia.metadata.tags.length > 0 && (
                  <div>
                    <strong>Tags:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMedia.metadata.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleDownload(selectedMedia)}>
                  <Download className="h-4 w-4" />{' '}
                  {selectedMedia.metadata.mediaType === 'link' ? 'Open link' : 'Download'}
                </Button>
                <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(selectedMedia)} disabled={selectedMedia.id.startsWith('response-')}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 