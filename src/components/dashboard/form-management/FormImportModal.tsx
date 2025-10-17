import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X,
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formsApi } from '@/lib/api/formsApi';
import { Form } from '@/components/dashboard/form-creation-wizard/types';

// File logging helper for debugging form imports
let logFileHandle: FileSystemFileHandle | null = null;
let logBuffer: string = '';

const logToFile = async (message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n\n`;
    
    // Also log to console for immediate feedback
    console.log(`[FRONTEND IMPORT LOG] ${message}`, data);
    
    // Initialize file handle if not already done
    if (!logFileHandle) {
      try {
        // Request file system access
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `form-import-debug-${new Date().toISOString().split('T')[0]}.txt`,
          types: [{
            description: 'Text files',
            accept: { 'text/plain': ['.txt'] }
          }]
        });
        logFileHandle = fileHandle;
        logBuffer = ''; // Reset buffer
      } catch (error) {
        // User cancelled or file system not supported, fallback to localStorage
        console.warn('File system access not available, falling back to localStorage');
        const existingLogs = localStorage.getItem('form-import-logs') || '';
        const newLogs = existingLogs + logEntry;
        localStorage.setItem('form-import-logs', newLogs);
        return;
      }
    }
    
    // Add to buffer
    logBuffer += logEntry;
    
    // Write to file periodically (every 10 entries or immediately for important logs)
    if (logBuffer.split('\n\n').length >= 10 || message.includes('✅') || message.includes('❌')) {
      await writeToFile();
    }
    
  } catch (error) {
    console.error('Failed to log to file:', error);
    console.log(`[FRONTEND IMPORT LOG] ${message}`, data);
    
    // Fallback to localStorage
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n\n`;
      const existingLogs = localStorage.getItem('form-import-logs') || '';
      const newLogs = existingLogs + logEntry;
      localStorage.setItem('form-import-logs', newLogs);
    } catch (localError) {
      console.error('Failed to log to localStorage:', localError);
    }
  }
};

const writeToFile = async () => {
  if (!logFileHandle || !logBuffer) return;
  
  try {
    const writable = await logFileHandle.createWritable();
    await writable.write(logBuffer);
    await writable.close();
    logBuffer = ''; // Clear buffer after writing
  } catch (error) {
    console.error('Failed to write to file:', error);
  }
};

const finalizeLogFile = async () => {
  if (logFileHandle && logBuffer) {
    await writeToFile();
  }
};

interface FormImportModalProps {
  projectId: string;
  onImportSuccess?: (importedForms: Form[]) => void;
  trigger?: React.ReactNode;
}

interface ImportFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  importedForm?: Form;
  importedForms?: Form[]; // For multiple forms in one file
  formCount?: number; // Number of forms in the file
}

export function FormImportModal({ projectId, onImportSuccess, trigger }: FormImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    // Filter for JSON files only
    const jsonFiles = selectedFiles.filter(file => 
      file.type === 'application/json' || file.name.endsWith('.json')
    );

    if (jsonFiles.length !== selectedFiles.length) {
      toast({
        title: "Invalid File Type",
        description: "Only JSON files are allowed for form import.",
        variant: "destructive",
      });
    }

    const newFiles: ImportFile[] = jsonFiles.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const validateFormData = (data: any): { isValid: boolean; error?: string } => {
    try {
      // Basic validation for form structure
      if (!data || typeof data !== 'object') {
        return { isValid: false, error: 'Invalid JSON structure' };
      }

      if (!data.title || typeof data.title !== 'string') {
        return { isValid: false, error: 'Missing or invalid form title' };
      }

      if (!data.sections || !Array.isArray(data.sections)) {
        return { isValid: false, error: 'Missing or invalid sections array' };
      }

      if (!data.settings || typeof data.settings !== 'object') {
        return { isValid: false, error: 'Missing or invalid settings object' };
      }

      // Validate sections have questions
      for (const section of data.sections) {
        if (!section.questions || !Array.isArray(section.questions)) {
          return { isValid: false, error: `Section "${section.title || 'Unknown'}" missing questions` };
        }
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid form data structure' };
    }
  };

  const parseFileContent = async (file: File): Promise<any[]> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Check if it's an array of forms or a single form
      if (Array.isArray(data)) {
        return data;
      } else {
        return [data];
      }
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  };

  const generateNewIds = (formData: any): any => {
    logToFile('🔍 Import - Starting ID generation process', {
      formTitle: formData.title,
      formId: formData.id,
      sectionsCount: formData.sections?.length || 0
    });
    
    // Generate new ID for the form itself
    const newFormId = uuidv4();
    
    // Create a mapping of old IDs to new IDs for reference
    const idMapping = new Map<string, string>();
    idMapping.set(formData.id || 'form', newFormId);

    // Generate new IDs for sections
    const newSections = formData.sections?.map((section: any) => {
      const newSectionId = uuidv4();
      idMapping.set(section.id, newSectionId);

      // First, identify which questions are conditional by checking if they appear in any option's conditionalQuestions
      const conditionalQuestionIds = new Set<string>();
      logToFile(`🔍 Import - Processing section "${section.title}" with ${section.questions?.length || 0} questions`);
      
      section.questions?.forEach((question: any, qIndex: number) => {
        logToFile(`🔍 Import - Question ${qIndex}: "${question.title}" (${question.type}) - ID: ${question.id}`);
        
        if (question.options && Array.isArray(question.options)) {
          question.options.forEach((option: any, optIndex: number) => {
            if (option.conditionalQuestions && Array.isArray(option.conditionalQuestions)) {
              logToFile(`🔍 Import - Option ${optIndex} "${option.label}" has ${option.conditionalQuestions.length} conditional questions`);
              option.conditionalQuestions.forEach((condQuestion: any, condIndex: number) => {
                logToFile(`🔍 Import - Conditional question ${condIndex}: "${condQuestion.title}" (${condQuestion.type}) - ID: ${condQuestion.id}`);
                conditionalQuestionIds.add(condQuestion.id);
              });
            }
          });
        }
      });
      
      logToFile(`🔍 Import - Found ${conditionalQuestionIds.size} conditional question IDs`, Array.from(conditionalQuestionIds));

      // Filter out conditional questions from main questions array to prevent duplicates
      const filteredQuestions = section.questions?.filter((question: any) => 
        !conditionalQuestionIds.has(question.id)
      );
      
      logToFile(`🔍 Import - Filtered out ${(section.questions?.length || 0) - (filteredQuestions?.length || 0)} conditional questions from main questions array`);
      logToFile(`🔍 Import - Processing ${filteredQuestions?.length || 0} main questions for section "${section.title}"`);
      
      const newQuestions = filteredQuestions?.map((question: any) => {
        const newQuestionId = uuidv4();
        idMapping.set(question.id, newQuestionId);

        logToFile(`🔍 Import - Processing main question "${question.title}"`);

        // Generate new IDs for question options (check multiple possible locations)
        const originalOptions = question.options || question.config?.options || [];
        const newOptions = originalOptions.map((option: any) => {
          const newOptionId = uuidv4();
          idMapping.set(option.id, newOptionId);

          logToFile(`🔍 Import - Processing option "${option.label}" with ${option.conditionalQuestions?.length || 0} conditional questions`);

          // Generate new IDs for conditional questions within this option
          const newConditionalQuestions = option.conditionalQuestions?.map((condQuestion: any) => {
            logToFile(`🔍 Import - Processing conditional question: "${condQuestion.title}" (${condQuestion.type}) - Old ID: ${condQuestion.id}`);
            const newCondQuestionId = uuidv4();
            idMapping.set(condQuestion.id, newCondQuestionId);

            // Generate new IDs for conditional question options (check multiple possible locations)
            const originalCondOptions = condQuestion.options || condQuestion.config?.options || [];
            const newCondOptions = originalCondOptions.map((condOption: any) => {
              const newCondOptionId = uuidv4();
              idMapping.set(condOption.id, newCondOptionId);

              return {
                ...condOption,
                id: newCondOptionId,
                assignedSectionId: condOption.assignedSectionId ? idMapping.get(condOption.assignedSectionId) || uuidv4() : undefined
              };
            });

            // Create the conditional question with options in the correct structure
            const updatedCondQuestion = {
              ...condQuestion,
              id: newCondQuestionId
            };

            // Always put options directly on the conditional question object
            updatedCondQuestion.options = newCondOptions;
            
            logToFile(`🔍 Import - Created conditional question with new ID: ${newCondQuestionId}`);

            return updatedCondQuestion;
          });

          return {
            ...option,
            id: newOptionId,
            conditionalQuestions: newConditionalQuestions,
            // Update conditional section references if they exist
            assignedSectionId: option.assignedSectionId ? idMapping.get(option.assignedSectionId) || uuidv4() : undefined
          };
        });

        // Create the question with options in the correct structure
        const updatedQuestion = {
          ...question,
          id: newQuestionId
        };

        // Always put options directly on the question object (backend expects this structure)
        updatedQuestion.options = newOptions;

        logToFile(`🔍 Import - Created main question "${question.title}"`);

        return updatedQuestion;
      });

      return {
        ...section,
        id: newSectionId,
        questions: newQuestions
      };
    });

    // Return the form data with all new IDs
    const result = {
      ...formData,
      id: newFormId,
      sections: newSections
    };
    
    logToFile('✅ Import - ID generation completed', {
      newFormId: newFormId,
      sectionsProcessed: newSections?.length || 0,
      totalQuestionsProcessed: newSections?.reduce((total: number, section: any) => total + (section.questions?.length || 0), 0) || 0
    });
    
    return result;
  };

  const processFile = async (importFile: ImportFile): Promise<ImportFile> => {
    try {
      logToFile('🔍 Import - Starting file processing', {
        fileName: importFile.file.name,
        fileSize: importFile.file.size
      });
      
      const formsData = await parseFileContent(importFile.file);
      const importedForms: Form[] = [];
      const errors: string[] = [];

      logToFile('🔍 Import - File parsed successfully', {
        formsCount: formsData.length
      });

      // Process each form in the file
      for (let i = 0; i < formsData.length; i++) {
        const originalFormData = formsData[i];
        
        logToFile(`🔍 Import - Processing form ${i + 1}/${formsData.length}`, {
          formTitle: originalFormData.title,
          formId: originalFormData.id
        });
        
        // Validate the form data first
        const validation = validateFormData(originalFormData);
        if (!validation.isValid) {
          logToFile(`❌ Import - Form ${i + 1} validation failed`, {
            error: validation.error
          });
          errors.push(`Form ${i + 1}: ${validation.error}`);
          continue;
        }

        // Generate new IDs for all form elements to avoid conflicts
        const formDataWithNewIds = generateNewIds(originalFormData);

        // Prepare form data for import using CreateFormDto structure
        const createFormData = {
          title: formDataWithNewIds.title,
          description: formDataWithNewIds.description || '',
          projectId: projectId,
          status: 'DRAFT' as const, // Import as draft by default
          sections: formDataWithNewIds.sections,
          settings: formDataWithNewIds.settings,
          tags: formDataWithNewIds.tags || [],
          category: formDataWithNewIds.category || 'General'
        };

        // Debug: Log choice question options before sending to API
        if (createFormData.sections) {
          createFormData.sections.forEach((section: any, sectionIndex: number) => {
            section.questions?.forEach((question: any, questionIndex: number) => {
              if ((question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && question.options) {
                logToFile(`Import - Section ${sectionIndex}, Question ${questionIndex} (${question.title})`, {
                  type: question.type,
                  options: question.options.map((opt: any) => ({
                    id: opt.id,
                    label: opt.label,
                    value: opt.value
                  }))
                });
              }
            });
          });
        }

        try {
          // Debug: Log what we're sending to the API
          logToFile('🚀 Sending to createForm API', {
            title: createFormData.title,
            sectionsCount: createFormData.sections?.length,
            sections: createFormData.sections?.map((section: any, sectionIndex: number) => ({
              index: sectionIndex,
              title: section.title,
              questionsCount: section.questions?.length,
              questions: section.questions?.map((question: any, questionIndex: number) => ({
                index: questionIndex,
                title: question.title,
                type: question.type,
                hasOptions: !!question.options,
                hasConfigOptions: !!question.config?.options,
                options: question.options || question.config?.options || []
              }))
            }))
          });

          // Create the form using the existing createForm endpoint
          const importedForm = await formsApi.createForm(projectId, createFormData);
          
          logToFile('✅ Import - Form created successfully via API', {
            importedFormId: importedForm.id,
            importedFormTitle: importedForm.title
          });
          
          // Debug: Log choice question options after API response
          logToFile('📡 Received from createForm API', {
            id: importedForm.id,
            title: importedForm.title,
            sectionsCount: importedForm.sections?.length
          });

          if (importedForm.sections) {
            importedForm.sections.forEach((section: any, sectionIndex: number) => {
              section.questions?.forEach((question: any, questionIndex: number) => {
                if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
                  logToFile(`API Response - Section ${sectionIndex}, Question ${questionIndex} (${question.title})`, {
                    type: question.type,
                    hasOptions: !!question.options,
                    hasConfigOptions: !!question.config?.options,
                    options: question.options?.map((opt: any) => ({
                      id: opt.id,
                      label: opt.label,
                      value: opt.value
                    })) || question.config?.options?.map((opt: any) => ({
                      id: opt.id,
                      label: opt.label,
                      value: opt.value
                    })) || []
                  });
                }
              });
            });
          }
          
          importedForms.push(importedForm);
        } catch (importError: any) {
          errors.push(`Form ${i + 1} (${originalFormData.title}): ${importError.message}`);
        }
      }

      // Determine overall status
      if (importedForms.length === 0) {
        return {
          ...importFile,
          status: 'error',
          error: errors.join('; '),
          formCount: formsData.length
        };
      } else if (errors.length > 0) {
        return {
          ...importFile,
          status: 'success',
          importedForm: importedForms[0], // Show first imported form
          importedForms: importedForms,
          formCount: formsData.length,
          error: `Imported ${importedForms.length} form(s), ${errors.length} failed: ${errors.join('; ')}`
        };
      } else {
        logToFile('✅ Import - File processing completed successfully', {
          importedFormsCount: importedForms.length,
          totalFormsInFile: formsData.length
        });
        
        return {
          ...importFile,
          status: 'success',
          importedForm: importedForms[0], // Show first imported form
          importedForms: importedForms,
          formCount: formsData.length
        };
      }
    } catch (error: any) {
      logToFile('❌ Import - File processing failed', {
        error: error.message || 'Failed to process file'
      });
      
      return {
        ...importFile,
        status: 'error',
        error: error.message || 'Failed to process file'
      };
    }
  };

  const handleImport = async () => {
    if (files.length === 0) return;

    logToFile('🔍 Import - Starting import process', {
      filesCount: files.length,
      fileNames: files.map(f => f.file.name)
    });

    setIsImporting(true);
    setImportProgress(0);

    const updatedFiles: ImportFile[] = [];
    const successfulImports: Form[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Update file status to processing
      updatedFiles[i] = { ...file, status: 'processing' };
      setFiles([...updatedFiles]);

      try {
        const result = await processFile(file);
        updatedFiles[i] = result;

        if (result.status === 'success' && result.importedForms) {
          successfulImports.push(...result.importedForms);
        }
      } catch (error: any) {
        updatedFiles[i] = {
          ...file,
          status: 'error',
          error: error.message || 'Import failed'
        };
      }

      // Update progress
      setImportProgress(((i + 1) / files.length) * 100);
    }

    setFiles(updatedFiles);
    setIsImporting(false);

    // Show results
    const successCount = successfulImports.length;
    const totalFiles = files.length;
    const successfulFiles = updatedFiles.filter(f => f.status === 'success').length;

    logToFile('✅ Import - Import process completed', {
      successCount,
      totalFiles,
      successfulFiles,
      failedFiles: totalFiles - successfulFiles
    });

    // Finalize the log file
    await finalizeLogFile();

    if (successCount > 0) {
      toast({
        title: "Import Successful",
        description: `${successCount} form(s) imported from ${successfulFiles} file(s)${successfulFiles < totalFiles ? `, ${totalFiles - successfulFiles} file(s) failed` : ''}`,
      });

      if (onImportSuccess) {
        onImportSuccess(successfulImports);
      }
    } else {
      toast({
        title: "Import Failed",
        description: "No forms were imported successfully. Please check the file formats and try again.",
        variant: "destructive",
      });
    }
  };

  const downloadLogs = async () => {
    try {
      // If we have a file handle, finalize the current file first
      if (logFileHandle) {
        await finalizeLogFile();
        toast({
          title: "Logs Saved",
          description: "Import debugging logs have been saved to the selected file.",
        });
        return;
      }
      
      // Fallback to localStorage download
      const logs = localStorage.getItem('form-import-logs');
      if (logs) {
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `form-import-debug-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Logs Downloaded",
          description: "Import debugging logs have been downloaded to your device.",
        });
      } else {
        toast({
          title: "No Logs Available",
          description: "No import logs found. Import a form first to generate logs.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to download logs:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download logs. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setFiles([]);
      setImportProgress(0);
      setIsOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusIcon = (status: ImportFile['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="w-4 h-4 text-gray-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: ImportFile['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-600';
      case 'processing':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import Forms
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Forms from JSON</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Drop JSON files here or click to browse
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              Select Files
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Select one or more JSON files containing form definitions
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Selected Files ({files.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(file.status)}
                      <div>
                        <p className={`font-medium ${getStatusColor(file.status)}`}>
                          {file.file.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {(file.file.size / 1024).toFixed(1)} KB
                          {file.formCount && file.formCount > 1 && (
                            <span className="ml-2 text-blue-600">• {file.formCount} forms</span>
                          )}
                        </p>
                        {file.error && (
                          <p className="text-sm text-red-500">{file.error}</p>
                        )}
                        {file.importedForm && (
                          <p className="text-sm text-green-600">
                            {file.importedForms && file.importedForms.length > 1 
                              ? `Imported ${file.importedForms.length} forms (e.g., ${file.importedForm.title})`
                              : `Imported as: ${file.importedForm.title}`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    {file.status === 'pending' && !isImporting && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing forms...</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
          )}

          {/* Import Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>JSON Format Requirements:</strong>
              <ul className="mt-2 text-sm space-y-1">
                <li>• Single form: JSON object with title, sections, settings</li>
                <li>• Multiple forms: JSON array of form objects</li>
                <li>• Sections must contain questions array</li>
                <li>• Each question needs: id, type, title, isRequired</li>
                <li>• Choice questions need options array</li>
                <li>• <strong>All IDs will be regenerated</strong> to avoid conflicts</li>
                <li>• Server-generated fields (timestamps, response counts) will be ignored</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={downloadLogs}
              disabled={isImporting}
            >
              <FileText className="w-4 h-4 mr-2" />
              {logFileHandle ? 'Save Logs' : 'Download Logs'}
            </Button>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={files.length === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {files.length} Form{files.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
