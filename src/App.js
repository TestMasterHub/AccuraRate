import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as diff from 'diff';
import * as XLSX from 'xlsx';

// PDF.js Worker Setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

function App() {
  // All existing state management (unchanged)
  const [page, setPage] = useState('home');
  const [oldPdf, setOldPdf] = useState(null);
  const [newPdf, setNewPdf] = useState(null);
  const [oldPdfSections, setOldPdfSections] = useState([]);
  const [newPdfSections, setNewPdfSections] = useState([]);
  const [newPdfName, setNewPdfName] = useState('');
  const [oldPdfName, setOldPdfName] = useState('');
  const [combinedSections, setCombinedSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState({});
  const [onlyNumeric, setOnlyNumeric] = useState(false);
  const [comparisonResult, setComparisonResult] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('');

  // All existing functions remain unchanged
  const parsePdf = useCallback(async (file) => {
    if (!file) return { sections: [], mode: 'PAGES' };
    
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async (event) => {
        try {
          const pdf = await pdfjsLib.getDocument(event.target.result).promise;
          const outline = await pdf.getOutline();
          let sections = [];
          let parseMode = 'TOC';

          const processOutline = async (outlineItems, level = 0) => {
            for (const item of outlineItems) {
              let pageNum = null;
              
              try {
                if (item.dest) {
                  try {
                    const destination = await pdf.getDestination(item.dest);
                    if (destination && destination[0]) {
                      const pageIndex = await pdf.getPageIndex(destination[0]);
                      pageNum = pageIndex + 1;
                    }
                  } catch (destError) {
                    if (typeof item.dest === 'string') {
                      console.warn(`Could not resolve destination for "${item.title}", trying alternative methods`);
                    } else if (Array.isArray(item.dest)) {
                      try {
                        const pageIndex = await pdf.getPageIndex(item.dest[0]);
                        pageNum = pageIndex + 1;
                      } catch (altError) {
                        console.warn(`Alternative destination method failed for "${item.title}"`);
                      }
                    }
                  }
                }
                
                if (pageNum === null && item.title) {
                  pageNum = sections.length + 1;
                  console.warn(`Using estimated page ${pageNum} for section "${item.title}"`);
                }
                
                if (item.title && item.title.trim()) {
                  sections.push({ 
                    title: item.title.trim(), 
                    startPage: pageNum || sections.length + 1,
                    level: level,
                    hasValidPage: pageNum !== null
                  });
                }
                
              } catch (e) {
                if (item.title && item.title.trim()) {
                  console.warn(`Adding section "${item.title}" without page reference due to error:`, e);
                  sections.push({ 
                    title: item.title.trim(), 
                    startPage: sections.length + 1,
                    level: level,
                    hasValidPage: false
                  });
                }
              }

              if (item.items && item.items.length > 0) {
                await processOutline(item.items, level + 1);
              }
            }
          };

          if (outline && outline.length > 0) {
            await processOutline(outline);
            
            if (sections.length > 0) {
              sections = sections.filter((section, index, self) =>
                index === self.findIndex((s) => s.title === section.title)
              );
              
              const validPageSections = sections.filter(s => s.hasValidPage);
              const invalidPageSections = sections.filter(s => !s.hasValidPage);
              
              if (validPageSections.length > 0) {
                validPageSections.sort((a, b) => a.startPage - b.startPage);
                invalidPageSections.forEach((section, index) => {
                  section.startPage = Math.ceil(pdf.numPages / (invalidPageSections.length + 1)) * (index + 1);
                });
                sections = [...validPageSections, ...invalidPageSections].sort((a, b) => a.startPage - b.startPage);
              } else {
                sections.forEach((section, index) => {
                  section.startPage = Math.ceil(pdf.numPages / sections.length) * index + 1;
                });
              }
              
              console.log(`Successfully parsed ${sections.length} sections from TOC`);
            }
          }
          
          if (sections.length === 0) {
            console.warn("No outline sections could be extracted. Falling back to page-by-page splitting.");
            parseMode = 'PAGES';
            for (let i = 1; i <= pdf.numPages; i++) {
              sections.push({ title: `Page ${i}`, startPage: i, hasValidPage: true });
            }
          } else {
            sections = sections.map(section => ({
              ...section,
              startPage: Math.min(section.startPage, pdf.numPages)
            }));
          }

          const extractedSections = [];
          for (let i = 0; i < sections.length; i++) {
            const startPage = sections[i].startPage;
            const endPage = (i + 1 < sections.length) ? sections[i + 1].startPage - 1 : pdf.numPages;
            let sectionText = '';
            for (let j = startPage; j <= endPage; j++) {
              if (j > pdf.numPages || j < 1) continue;
              const page = await pdf.getPage(j);
              const textContent = await page.getTextContent();
              sectionText += textContent.items.map(item => item.str).join(' ');
            }
            extractedSections.push({ title: sections[i].title, text: sectionText });
          }
          resolve({ sections: extractedSections, mode: parseMode });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }, []);

  useEffect(() => {
    const processFiles = async () => {
      if (!oldPdf || !newPdf) return;
      setIsLoading(true);
      setError('');
      setFallbackMessage('');
      setComparisonResult([]);
      try {
        const [oldResult, newResult] = await Promise.all([
          parsePdf(oldPdf),
          parsePdf(newPdf)
        ]);
        setOldPdfSections(oldResult.sections);
        setNewPdfSections(newResult.sections);

        if (oldResult.mode === 'PAGES' || newResult.mode === 'PAGES') {
            setFallbackMessage('One or both PDFs lacked a table of contents. Comparison is based on page numbers.');
        }

      } catch (err) {
        console.error("PDF Parsing Error:", err);
        setError(`Failed to parse PDF: ${err.message}. Please ensure the file is not corrupted.`);
      } finally {
        setIsLoading(false);
      }
    };
    processFiles();
  }, [oldPdf, newPdf, parsePdf]);

  useEffect(() => {
    const oldTitles = oldPdfSections.map(s => s.title);
    const newTitles = newPdfSections.map(s => s.title);
    const allTitles = [...new Set([...oldTitles, ...newTitles])].sort();
    setCombinedSections(allTitles);
    const initialSelection = allTitles.reduce((acc, title) => {
      acc[title] = true;
      return acc;
    }, {});
    setSelectedSections(initialSelection);
  }, [oldPdfSections, newPdfSections]);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setError('');
      if (type === 'new') {
        setNewPdf(file);
        setNewPdfName(file.name);
      }
      if (type === 'old') {
        setOldPdf(file);
        setOldPdfName(file.name);
      }
    } else {
      setError('Please select a valid PDF file.');
      if (type === 'new') {
        setNewPdf(null);
        setNewPdfName('');
      }
      if (type === 'old') {
        setOldPdf(null);
        setOldPdfName('');
      }
    }
  };

  const handleSectionToggle = (title) => {
    setSelectedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const extractNumerics = (text) => {
    const numericRegex = /-?\d+(?:,\d{3})*(?:\.\d+)?/g;
    const numbers = text.match(numericRegex) || [];
    return numbers.map(n => n.replace(/,/g, '')).join('\n');
  };

  // Updated parseNumericComparison function for code editor style formatting
  const parseNumericComparison = (oldText, newText, sectionTitle) => {
    const oldLines = oldText.split('\n').filter(n => n.trim());
    const newLines = newText.split('\n').filter(n => n.trim());
    
    // Create maps for old and new values
    const oldMap = new Map();
    const newMap = new Map();
    
    // Parse old values
    oldLines.forEach(line => {
      const [variable, value] = line.split('=').map(s => s.trim());
      if (variable && value) {
        oldMap.set(variable, value);
      }
    });
    
    // Parse new values
    newLines.forEach(line => {
      const [variable, value] = line.split('=').map(s => s.trim());
      if (variable && value) {
        newMap.set(variable, value);
      }
    });
    
    // Find all unique variables
    const allVariables = new Set([...oldMap.keys(), ...newMap.keys()]);
    
    // Create comparison results
    const comparison = [];
    for (const variable of allVariables) {
      const oldValue = oldMap.get(variable) || '0';
      const newValue = newMap.get(variable) || '0';
      
      // Only include if there's actually a difference
      if (oldValue !== newValue) {
        comparison.push({
          category: variable,
          oldValue: oldValue,
          newValue: newValue,
          type: 'change'
        });
      }
    }
    
    return comparison;
  };

  const handleCompare = () => {
    setIsLoading(true);
    setError('');
    const results = [];
    
    combinedSections.forEach(title => {
      if (!selectedSections[title]) return;

      const oldSection = oldPdfSections.find(s => s.title === title);
      const newSection = newPdfSections.find(s => s.title === title);

      let oldText = oldSection ? oldSection.text : '';
      let newText = newSection ? newSection.text : '';

      if (onlyNumeric) {
        oldText = extractNumerics(oldText);
        newText = extractNumerics(newText);
        
        // Use structured numeric comparison for code editor style
        const numericComparison = parseNumericComparison(oldText, newText, title);
        if (numericComparison.length > 0) {
          results.push({ title, changes: null, numericChanges: numericComparison });
        }
      } else {
        const differences = diff.diffLines(oldText.trim(), newText.trim(), { newlineIsToken: true, ignoreWhitespace: true });
        const changes = differences.filter(part => part.added || part.removed);
        
        if (changes.length > 0) {
          results.push({ title, changes });
        }
      }
    });

    setComparisonResult(results);
    setIsLoading(false);
  };

  const handleExport = () => {
    const exportData = [];
    comparisonResult.forEach(({ title, changes, numericChanges }) => {
      if (numericChanges) {
        // Export numeric changes
        numericChanges.forEach(change => {
          exportData.push({
            'Section Title': title,
            'Category': change.category,
            'Old Value': change.oldValue,
            'New Value': change.newValue,
            'Difference Type': 'Numeric'
          });
        });
      } else if (changes) {
        // Export text changes
        let i = 0;
        while (i < changes.length) {
          const current = changes[i];
          const next = (i + 1 < changes.length) ? changes[i + 1] : null;

          let row = {
            'Section Title': title,
            'Old Value': '',
            'New Value': '',
            'Difference Type': onlyNumeric ? 'Numeric' : 'Textual'
          };

          if (current.removed && next && next.added) {
            row['Old Value'] = current.value.trim();
            row['New Value'] = next.value.trim();
            i += 2;
          } else if (current.removed) {
            row['Old Value'] = current.value.trim();
            i++;
          } else if (current.added) {
            row['New Value'] = current.value.trim();
            i++;
          } else {
            i++;
          }
          exportData.push(row);
        }
      }
    });
    
    if (exportData.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Differences");
        XLSX.writeFile(workbook, "Rate_Comparison_Report.xlsx");
    } else {
        setError("No differences to export.");
    }
  };

  // REDESIGNED CSS Styles with code editor theme
  const styles = {
    app: {
      backgroundColor: '#f4f7f9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#2d3748',
    },
    navbar: {
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      padding: '0.75rem 0',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },
    navContainer: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '0 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logo: {
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '#2c5282',
      cursor: 'pointer',
    },
    navButtons: {
      display: 'flex',
      gap: '0.25rem',
    },
    navButton: (isActive) => ({
      padding: '0.5rem 1rem',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      background: isActive ? '#3182ce' : 'transparent',
      color: isActive ? 'white' : '#4a5568',
    }),
    main: {
      padding: '1.5rem 2rem',
      maxWidth: '1400px',
      margin: '0 auto',
    },
    header: {
      textAlign: 'center',
      marginBottom: '2rem',
    },
    title: {
      fontSize: '2.25rem',
      fontWeight: '700',
      marginBottom: '0.5rem',
      color: '#1a202c',
    },
    subtitle: {
      fontSize: '1.1rem',
      color: '#718096',
    },
    container: {
      display: 'grid',
      gridTemplateColumns: '380px 1fr',
      gap: '1.5rem',
    },
    card: {
      background: '#ffffff',
      borderRadius: '8px',
      padding: '1.5rem',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      border: '1px solid #e2e8f0',
    },
    stepHeader: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '1rem',
      paddingBottom: '0.75rem',
      borderBottom: '1px solid #e2e8f0',
    },
    stepNumber: (color) => ({
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: color,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '1rem',
      marginRight: '0.75rem',
    }),
    stepTitle: {
      fontSize: '1.2rem',
      fontWeight: '600',
      color: '#2d3748',
      margin: 0,
    },
    fileInputContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        border: '1px solid #cbd5e0',
        borderRadius: '6px',
        paddingLeft: '0.75rem',
    },
    fileInput: { display: 'none' },
    fileInputLabel: {
        padding: '0.5rem 1rem',
        background: '#edf2f7',
        borderLeft: '1px solid #cbd5e0',
        cursor: 'pointer',
        fontSize: '0.9rem',
        whiteSpace: 'nowrap'
    },
    fileName: {
        fontSize: '0.85rem',
        color: '#4a5568',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    sectionsList: {
      maxHeight: '350px',
      overflowY: 'auto',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      background: '#fdfdff',
    },
    sectionItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '0.6rem 0.8rem',
      borderBottom: '1px solid #e2e8f0',
      fontSize: '0.9rem',
    },
    checkbox: {
      marginRight: '0.75rem',
      width: '16px',
      height: '16px',
    },
    compareButton: {
      width: '100%',
      padding: '0.75rem',
      background: '#2c5282',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
    },
    resultsHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
      paddingBottom: '1rem',
      borderBottom: '1px solid #e2e8f0',
    },
    resultsTitle: {
      fontSize: '1.2rem',
      fontWeight: '600',
      margin: 0,
    },
    exportButton: {
      padding: '0.5rem 1rem',
      background: '#2c7a7b',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontWeight: '500',
      cursor: 'pointer',
      fontSize: '0.9rem',
      transition: 'background-color 0.2s ease',
    },
    resultsContainer: {
      maxHeight: 'calc(100vh - 250px)',
      overflowY: 'auto',
    },
    resultItem: {
      marginBottom: '1rem',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      overflow: 'hidden',
    },
    resultHeader: {
      padding: '0.75rem 1rem',
      background: '#f7fafc',
      borderBottom: '1px solid #e2e8f0',
      fontWeight: '600',
      color: '#4a5568',
      fontSize: '0.95rem',
    },
    resultContent: {
      padding: '0.5rem 1rem',
      fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: '0.8rem',
      lineHeight: '1.5',
      background: '#ffffff',
    },
    // New code editor styles for numeric comparison
    codeEditor: {
      background: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: '"Fira Code", "Cascadia Code", Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: '0.85rem',
      lineHeight: '1.6',
      padding: '1rem',
      borderRadius: '6px',
      margin: 0,
      overflow: 'auto',
      border: '1px solid #3c3c3c',
    },
    codeLine: {
      display: 'flex',
      minHeight: '1.6em',
      alignItems: 'center',
    },
    lineNumber: {
      color: '#858585',
      minWidth: '2.5em',
      textAlign: 'right',
      paddingRight: '1em',
      userSelect: 'none',
      fontSize: '0.8em',
    },
    codeContent: {
      flex: 1,
    },
    sectionTitle: {
      color: '#4fc1ff',
      fontWeight: 'bold',
    },
    categoryName: {
      color: '#dcdcaa',
    },
    operator: {
      color: '#d4d4d4',
    },
    oldValue: {
      color: '#f44747',
      textDecoration: 'line-through',
    },
    newValue: {
      color: '#4ec9b0',
    },
    arrow: {
      color: '#569cd6',
      fontWeight: 'bold',
    },
    diffAdded: {
      backgroundColor: '#f0fff4',
      borderLeft: '3px solid #48bb78',
      paddingLeft: '0.5rem',
    },
    diffRemoved: {
      backgroundColor: '#fff5f5',
      borderLeft: '3px solid #f56565',
      textDecoration: 'line-through',
      paddingLeft: '0.5rem',
    },
    emptyState: {
      textAlign: 'center',
      padding: '3rem 1rem',
      color: '#a0aec0',
    },
    emptyTitle: {
      fontSize: '1.2rem',
      fontWeight: '600',
      marginBottom: '0.5rem',
      color: '#4a5568',
    },
    alert: {
      padding: '1rem',
      borderRadius: '6px',
      marginBottom: '1.5rem',
      border: '1px solid #f56565',
      background: '#fed7d7',
      color: '#c53030',
    },
    warning: {
        padding: '0.75rem 1rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        border: '1px solid #f6e05e',
        background: '#fefcbf',
        color: '#b7791f',
        fontSize: '0.9rem',
    },
    loading: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      color: '#718096',
    },
    spinner: {
      width: '20px',
      height: '20px',
      border: '2px solid #e2e8f0',
      borderTop: '2px solid #3182ce',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
    footer: {
      background: '#ffffff',
      color: '#718096',
      textAlign: 'center',
      padding: '1.5rem',
      marginTop: '2rem',
      borderTop: '1px solid #e2e8f0',
      fontSize: '0.9rem'
    },
  };

const HomePage = () => (
    <>
      <div style={styles.header}>
        <h1 style={styles.title}>Document Comparison Tool</h1>
        <p style={styles.subtitle}>Upload two PDF documents to identify changes with precision.</p>
      </div>

      {error && (
        <div style={styles.alert}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={styles.container}>
        {/* Left Panel - Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Step 1: Upload */}
          <div style={styles.card}>
            <div style={styles.stepHeader}>
              <div style={styles.stepNumber('#3182ce')}>1</div>
              <h3 style={styles.stepTitle}>Upload Documents</h3>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#4a5568', fontSize: '0.9rem' }}>
                New Version (e.g., 2025 Rates)
              </label>
              <div style={styles.fileInputContainer}>
                <span style={styles.fileName}>{newPdfName || 'No file chosen...'}</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'new')}
                  style={styles.fileInput}
                  id="new-file-input"
                />
                <label htmlFor="new-file-input" style={styles.fileInputLabel}>Browse</label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#4a5568', fontSize: '0.9rem' }}>
                Old Version (e.g., 2024 Rates)
              </label>
              <div style={styles.fileInputContainer}>
                <span style={styles.fileName}>{oldPdfName || 'No file chosen...'}</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'old')}
                  style={styles.fileInput}
                  id="old-file-input"
                />
                 <label htmlFor="old-file-input" style={styles.fileInputLabel}>Browse</label>
              </div>
            </div>
          </div>

          {/* Step 2: Select Sections */}
          <div style={styles.card}>
            <div style={styles.stepHeader}>
              <div style={styles.stepNumber('#6b46c1')}>2</div>
              <h3 style={styles.stepTitle}>Select Sections</h3>
            </div>

            {fallbackMessage && <div style={styles.warning}>{fallbackMessage}</div>}

            {isLoading && !combinedSections.length ? (
              <div style={styles.loading}>
                <div style={styles.spinner}></div>
                <span style={{ marginLeft: '0.75rem' }}>Parsing PDFs...</span>
              </div>
            ) : combinedSections.length > 0 ? (
              <div style={styles.sectionsList}>
                {combinedSections.map(title => (
                  <div key={title} style={styles.sectionItem}>
                    <input
                      type="checkbox"
                      checked={selectedSections[title] || false}
                      onChange={() => handleSectionToggle(title)}
                      style={styles.checkbox}
                    />
                    <span>{title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ ...styles.emptyState, padding: '1.5rem 1rem', fontSize: '0.9rem' }}>
                <p>Upload both PDF files to see available sections for comparison.</p>
              </div>
            )}
          </div>

          {/* Step 3: Compare */}
          <div style={styles.card}>
            <div style={styles.stepHeader}>
              <div style={styles.stepNumber('#2f855a')}>3</div>
              <h3 style={styles.stepTitle}>Compare</h3>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={onlyNumeric}
                  onChange={(e) => setOnlyNumeric(e.target.checked)}
                  style={styles.checkbox}
                />
                Compare only numeric values
              </label>
            </div>
            
            <button
              onClick={handleCompare}
              disabled={isLoading || !oldPdf || !newPdf}
              style={{
                ...styles.compareButton,
                opacity: (isLoading || !oldPdf || !newPdf) ? 0.6 : 1,
                cursor: (isLoading || !oldPdf || !newPdf) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Comparing...' : 'Compare Selected Sections'}
            </button>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div style={styles.card}>
          <div style={styles.resultsHeader}>
            <h3 style={styles.resultsTitle}>Comparison Results</h3>
            <button
              onClick={handleExport}
              disabled={comparisonResult.length === 0}
              style={{
                ...styles.exportButton,
                opacity: comparisonResult.length === 0 ? 0.6 : 1,
                cursor: comparisonResult.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Export to Excel
            </button>
          </div>

          {comparisonResult.length > 0 ? (
            <div style={styles.resultsContainer}>
              {comparisonResult.map(({ title, changes, numericChanges }) => (
                <div key={title} style={styles.resultItem}>
                  <div style={styles.resultHeader}>{title}</div>
                  {numericChanges ? (
                    // Code editor style for numeric comparison
                    <pre style={styles.codeEditor}>
                      <div style={styles.codeLine}>
                        <span style={styles.lineNumber}>1</span>
                        <div style={styles.codeContent}>
                          <span style={styles.sectionTitle}>{title.toLowerCase().replace(/\s+/g, '_')}_differences</span>
                          <span style={styles.operator}>(</span>
                          <span style={styles.oldValue}>Old</span>
                          <span style={styles.arrow}> -> </span>
                          <span style={styles.newValue}>New</span>
                          <span style={styles.operator}>):</span>
                        </div>
                      </div>
                      {numericChanges.map((change, index) => (
                        <div key={index}>
                          <div style={styles.codeLine}>
                            <span style={styles.lineNumber}>{index + 2}</span>
                            <div style={styles.codeContent}>
                              <span style={styles.categoryName}>{change.category}</span>
                              <span style={styles.operator}> = </span>
                              <span style={styles.oldValue}>{change.oldValue}</span>
                              <span style={styles.arrow}> -> </span>
                              <span style={styles.newValue}>{change.newValue}</span>
                            </div>
                          </div>
                          {index < numericChanges.length - 1 && index % 2 === 1 && (
                            <div style={styles.codeLine}>
                              <span style={styles.lineNumber}>{index + 3}</span>
                              <div style={styles.codeContent}>
                                <span style={styles.operator}>...</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </pre>
                  ) : (
                    // Regular text comparison
                    <div style={styles.resultContent}>
                      {changes.map((part, index) => (
                        <div key={index} style={part.added ? styles.diffAdded : part.removed ? styles.diffRemoved : {}}>
                          {part.value.trim().split('\n').map((line, i) => (
                            <div key={i} style={{ display: 'flex' }}>
                              <span style={{ marginRight: '0.5rem', userSelect: 'none' }}>{part.added ? '+' : '-'}</span>
                              <span>{line}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <h4 style={styles.emptyTitle}>Ready to Compare</h4>
              <p>Results will appear here after you compare the documents.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const AboutPage = () => (
    <div style={{...styles.card, maxWidth: '900px', margin: '2rem auto'}}>
        <h1 style={{...styles.title, textAlign: 'center'}}>About AccuraRate</h1>
        <p style={{...styles.subtitle, textAlign: 'center'}}>A powerful, client-side tool for document comparison.</p>
        
        <p style={{marginTop: '2rem', lineHeight: '1.7'}}>
            This application helps users quickly identify changes in policy documents, rate sheets, and other formal texts, saving valuable time and reducing the risk of manual errors. All processing is done securely in your browser.
        </p>

        <h2 style={{...styles.stepTitle, marginTop: '2.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem'}}>Core Features</h2>
        <ul style={{listStyle: 'none', padding: 0, marginTop: '1rem', lineHeight: '1.8'}}>
            <li style={{marginBottom: '0.75rem'}}><strong>Side-by-Side Comparison:</strong> Upload two PDF versions to see differences highlighted with precision.</li>
            <li style={{marginBottom: '0.75rem'}}><strong>Intelligent Section Extraction:</strong> Automatically parses sections from a PDF's Table of Contents, with a reliable page-by-page fallback.</li>
            <li style={{marginBottom: '0.75rem'}}><strong>Numeric-Only Mode:</strong> Isolate and compare only numbers within documents—perfect for rate tables.</li>
            <li style={{marginBottom: '0.75rem'}}><strong>Excel Export:</strong> Download a detailed report of all identified differences in a convenient .xlsx format.</li>
            <li style={{marginBottom: '0.75rem'}}><strong>Secure & Private:</strong> All processing is done in your browser. Your documents are never uploaded to a server.</li>
        </ul>
    </div>
  );

  const PrivacyPage = () => (
    <div style={{...styles.card, maxWidth: '900px', margin: '2rem auto'}}>
        <h1 style={{...styles.title, textAlign: 'center'}}>Privacy Policy</h1>
        <p style={{...styles.subtitle, textAlign: 'center'}}>Your privacy and data security are our highest priorities.</p>

        <div style={{marginTop: '2.5rem'}}>
            <h2 style={styles.stepTitle}>No Data Collection</h2>
            <p style={{lineHeight: '1.7', marginTop: '0.5rem'}}>
                AccuraRate is designed with privacy as its top priority. We do not collect, store, or transmit any personal data or any content from the PDF documents you upload.
                All PDF processing and comparison tasks are performed locally within your web browser using JavaScript. Your files are never sent to our servers or any third-party service.
            </p>
        </div>

        <div style={{marginTop: '2rem'}}>
            <h2 style={styles.stepTitle}>Open Source Commitment</h2>
            <p style={{lineHeight: '1.7', marginTop: '0.5rem'}}>
                We believe in transparency. AccuraRate is an open-source project. You are free to review the source code on our{' '}
                <a href="https://github.com/TestMasterHub/AccuraRate" target="_blank" rel="noopener noreferrer" style={{color: '#3182ce', textDecoration: 'underline'}}>GitHub repository</a> to verify our privacy claims.
            </p>
        </div>
    </div>
  );

  const renderPage = () => {
    switch (page) {
      case 'about':
        return <AboutPage />;
      case 'privacy':
        return <PrivacyPage />;
      case 'home':
      default:
        return <HomePage />;
    }
  };

  return (
    <div style={styles.app}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          body { margin: 0; }
        `}
      </style>

      <nav style={styles.navbar}>
        <div style={styles.navContainer}>
          <div onClick={() => setPage('home')} style={styles.logo}>AccuraRate<sup style={{fontSize: '0.5em',fontFamily: 'sans-serif'}}> By TestMasterHub</sup></div>
          <div style={styles.navButtons}>
            {[
              { id: 'home', label: 'Home' },
              { id: 'about', label: 'About' },
              { id: 'privacy', label: 'Privacy' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                style={styles.navButton(page === item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main style={styles.main}>
        {renderPage()}
      </main>

      <footer style={styles.footer}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          <p style={{marginBottom: '0.5rem', opacity: 0.9}}>
            © {new Date().getFullYear()} AccuraRate. Developed by{' '}
            <span style={{fontWeight: '600', color: '#1738deff'}}>TestMasterHub</span>. All Rights Reserved.
          </p>
          
          <p style={{fontSize: '0.9rem', opacity: 0.7, marginBottom: '1rem'}}>
            AccuraRate is an open-source project. Visit us on{' '}
            <a 
              href="https://github.com/TestMasterHub/AccuraRate" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{color: '#1738deff', textDecoration: 'underline'}}
            >
              GitHub
            </a>.
          </p>
          
          <div style={{display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.9rem', opacity: 0.8}}>
            <span style={{display: 'flex', alignItems: 'center'}}>
              <span style={{marginRight: '0.5rem'}}>🛡️</span> 100% Client-Side
            </span>
            <span style={{display: 'flex', alignItems: 'center'}}>
              <span style={{marginRight: '0.5rem'}}>🔒</span> Privacy First
            </span>
            <span style={{display: 'flex', alignItems: 'center'}}>
              <span style={{marginRight: '0.5rem'}}>💻</span> Open Source
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;