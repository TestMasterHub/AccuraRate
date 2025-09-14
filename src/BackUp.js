import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.mjs';
import * as diff from 'https://cdn.jsdelivr.net/npm/diff@5.2.0/+esm';
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

// PDF.js Worker Setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.mjs`;

function App() {
  // All existing state management (unchanged)
  const [page, setPage] = useState('home');
  const [oldPdf, setOldPdf] = useState(null);
  const [newPdf, setNewPdf] = useState(null);
  const [oldPdfSections, setOldPdfSections] = useState([]);
  const [newPdfSections, setNewPdfSections] = useState([]);
  const [newPdfName, setNewPdfName] = useState('No file selected');
  const [oldPdfName, setOldPdfName] = useState('No file selected');
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
            setFallbackMessage('Some sections may use estimated page ranges due to PDF structure limitations.');
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
        setNewPdfName('No file selected');
      }
      if (type === 'old') {
        setOldPdf(null);
        setOldPdfName('No file selected');
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
      }
      
      const differences = diff.diffLines(oldText.trim(), newText.trim(), { newlineIsToken: true, ignoreWhitespace: true });
      const changes = differences.filter(part => part.added || part.removed);
      
      if (changes.length > 0) {
        results.push({ title, changes });
      }
    });

    setComparisonResult(results);
    setIsLoading(false);
  };

  const handleExport = () => {
    const exportData = [];
    comparisonResult.forEach(({ title, changes }) => {
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

  // CSS Styles
  const styles = {
    app: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    navbar: {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      padding: '1rem 0'
    },
    navContainer: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    logo: {
      fontSize: '2rem',
      fontWeight: 'bold',
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    },
    navButtons: {
      display: 'flex',
      gap: '0.5rem'
    },
    navButton: (isActive) => ({
      padding: '0.75rem 1.5rem',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      fontWeight: '500',
      transition: 'all 0.3s ease',
      background: isActive 
        ? 'linear-gradient(135deg, #667eea, #764ba2)' 
        : 'rgba(255, 255, 255, 0.1)',
      color: isActive ? 'white' : '#333',
      boxShadow: isActive ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none'
    }),
    main: {
      padding: '2rem',
      maxWidth: '1400px',
      margin: '0 auto'
    },
    header: {
      textAlign: 'center',
      marginBottom: '3rem',
      color: 'white'
    },
    title: {
      fontSize: '3rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
    },
    subtitle: {
      fontSize: '1.2rem',
      opacity: 0.9,
      marginBottom: '0'
    },
    container: {
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      gap: '2rem',
      minHeight: '70vh'
    },
    card: {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '20px',
      padding: '2rem',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    },
    stepHeader: (color) => ({
      display: 'flex',
      alignItems: 'center',
      marginBottom: '2rem',
      padding: '1rem',
      borderRadius: '12px',
      background: `linear-gradient(135deg, ${color}20, ${color}10)`,
      border: `2px solid ${color}30`
    }),
    stepNumber: (color) => ({
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '1.2rem',
      marginRight: '1rem',
      boxShadow: `0 4px 15px ${color}40`
    }),
    stepTitle: {
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '#333',
      margin: 0
    },
    uploadArea: {
      border: '3px dashed #667eea',
      borderRadius: '16px',
      padding: '3rem 2rem',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #667eea10, #764ba220)',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      marginBottom: '2rem'
    },
    uploadAreaHover: {
      borderColor: '#764ba2',
      background: 'linear-gradient(135deg, #667eea20, #764ba230)',
      transform: 'translateY(-2px)'
    },
    uploadIcon: {
      fontSize: '3rem',
      color: '#667eea',
      marginBottom: '1rem'
    },
    uploadText: {
      fontSize: '1.1rem',
      color: '#555',
      fontWeight: '500'
    },
    fileInput: {
      display: 'none'
    },
    fileName: {
      marginTop: '1rem',
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(135deg, #10b98120, #059f4620)',
      borderRadius: '10px',
      color: '#065f46',
      fontWeight: '500',
      border: '1px solid #10b98140'
    },
    sectionsList: {
      maxHeight: '300px',
      overflowY: 'auto',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      background: '#f9fafb'
    },
    sectionItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '1rem',
      borderBottom: '1px solid #e5e7eb',
      transition: 'background-color 0.2s ease'
    },
    sectionItemHover: {
      backgroundColor: '#f3f4f6'
    },
    checkbox: {
      marginRight: '1rem',
      transform: 'scale(1.2)'
    },
    compareButton: {
      width: '100%',
      padding: '1rem 2rem',
      background: 'linear-gradient(135deg, #10b981, #059f46)',
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      fontSize: '1.1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
      marginTop: '1rem'
    },
    compareButtonHover: {
      background: 'linear-gradient(135deg, #059f46, #047857)',
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.6)'
    },
    resultsHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      padding: '1rem',
      background: 'linear-gradient(135deg, #1f293720, #11182710)',
      borderRadius: '12px'
    },
    resultsTitle: {
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '#333',
      margin: 0
    },
    exportButton: {
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)'
    },
    exportButtonHover: {
      background: 'linear-gradient(135deg, #0891b2, #0e7490)',
      transform: 'translateY(-2px)'
    },
    resultsContainer: {
      maxHeight: '500px',
      overflowY: 'auto'
    },
    resultItem: {
      marginBottom: '2rem',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      overflow: 'hidden'
    },
    resultHeader: {
      padding: '1rem',
      background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
      borderBottom: '1px solid #e5e7eb',
      fontWeight: '600',
      color: '#374151'
    },
    resultContent: {
      padding: '1rem',
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
      fontSize: '0.9rem',
      lineHeight: '1.6',
      background: '#fafafa'
    },
    diffAdded: {
      backgroundColor: '#dcfce7',
      color: '#166534',
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      margin: '0.125rem 0',
      borderLeft: '4px solid #16a34a'
    },
    diffRemoved: {
      backgroundColor: '#fef2f2',
      color: '#991b1b',
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      margin: '0.125rem 0',
      borderLeft: '4px solid #dc2626',
      textDecoration: 'line-through'
    },
    emptyState: {
      textAlign: 'center',
      padding: '4rem 2rem',
      color: '#6b7280'
    },
    emptyIcon: {
      fontSize: '4rem',
      marginBottom: '1rem',
      opacity: 0.5
    },
    emptyTitle: {
      fontSize: '1.5rem',
      fontWeight: '600',
      marginBottom: '0.5rem',
      color: '#374151'
    },
    emptyDescription: {
      fontSize: '1rem',
      opacity: 0.8
    },
    alert: {
      padding: '1rem',
      borderRadius: '12px',
      marginBottom: '2rem',
      border: '1px solid #fecaca',
      background: 'linear-gradient(135deg, #fef2f2, #fef7f7)',
      color: '#991b1b'
    },
    warning: {
      padding: '1rem',
      borderRadius: '12px',
      marginBottom: '1rem',
      border: '1px solid #fed7aa',
      background: 'linear-gradient(135deg, #fffbeb, #fef7ed)',
      color: '#92400e'
    },
    loading: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    },
    spinner: {
      width: '24px',
      height: '24px',
      border: '3px solid #f3f4f6',
      borderTop: '3px solid #667eea',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    footer: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      color: 'white',
      textAlign: 'center',
      padding: '2rem',
      marginTop: '3rem'
    }
  };

const HomePage = () => (
  <div style={{...styles.main}} className="main-padding">
    <div style={styles.header}>
      <h1 style={styles.title} className="title-size">Document Comparison Tool</h1>
      <p style={styles.subtitle}>Upload two PDF documents and identify changes with precision</p>
    </div>

    {error && (
      <div style={styles.alert}>
        <strong>Error:</strong> {error}
        <button 
          onClick={() => setError('')}
          style={{
            float: 'right',
            background: 'none',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#991b1b'
          }}
        >
          ×
        </button>
      </div>
    )}

    <div style={styles.container} className="container-grid">
      {/* Left Panel - Controls */}
      <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '380px'}} className="left-panel">
        {/* Step 1: Upload */}
        <div style={styles.card} className="card-padding">
          <div style={styles.stepHeader('#667eea')}>
            <div style={styles.stepNumber('#667eea')}>1</div>
            <h3 style={styles.stepTitle}>Upload Documents</h3>
          </div>
          
          {/* New Version Upload */}
          <div style={{marginBottom: '1.5rem'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '0.75rem', color: '#374151'}}>
              New Version (e.g., 2025 Rates)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileChange(e, 'new')}
              style={styles.fileInput}
              id="new-file-input"
            />
            <label 
              htmlFor="new-file-input" 
              style={{
                ...styles.uploadArea,
                padding: '1.5rem 1rem',
                border: '2px dashed #667eea',
              }}
              onMouseEnter={(e) => Object.assign(e.target.style, styles.uploadAreaHover)}
              onMouseLeave={(e) => Object.assign(e.target.style, {
                ...styles.uploadArea,
                padding: '1.5rem 1rem',
                border: '2px dashed #667eea',
              })}
            >
              <div style={{...styles.uploadIcon, fontSize: '2rem'}}>📄</div>
              <div style={{...styles.uploadText, fontSize: '0.95rem'}}>Click to choose new version</div>
            </label>
            {newPdfName !== 'No file selected' && (
              <div style={{...styles.fileName, fontSize: '0.9rem', padding: '0.5rem 1rem'}}>
                📎 {newPdfName}
              </div>
            )}
          </div>

          {/* Old Version Upload */}
          <div>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '0.75rem', color: '#374151'}}>
              Old Version (e.g., 2024 Rates)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileChange(e, 'old')}
              style={styles.fileInput}
              id="old-file-input"
            />
            <label 
              htmlFor="old-file-input" 
              style={{
                ...styles.uploadArea,
                padding: '1.5rem 1rem',
                border: '2px dashed #667eea',
              }}
              onMouseEnter={(e) => Object.assign(e.target.style, styles.uploadAreaHover)}
              onMouseLeave={(e) => Object.assign(e.target.style, {
                ...styles.uploadArea,
                padding: '1.5rem 1rem',
                border: '2px dashed #667eea',
              })}
            >
              <div style={{...styles.uploadIcon, fontSize: '2rem'}}>📄</div>
              <div style={{...styles.uploadText, fontSize: '0.95rem'}}>Click to choose old version</div>
            </label>
            {oldPdfName !== 'No file selected' && (
              <div style={{...styles.fileName, fontSize: '0.9rem', padding: '0.5rem 1rem'}}>
                📎 {oldPdfName}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Select Sections */}
        <div style={styles.card} className="card-padding">
          <div style={styles.stepHeader('#8b5cf6')}>
            <div style={styles.stepNumber('#8b5cf6')}>2</div>
            <h3 style={styles.stepTitle}>Select Sections</h3>
          </div>

          {fallbackMessage && (
            <div style={styles.warning}>
              ⚠️ {fallbackMessage}
            </div>
          )}

          {isLoading && !combinedSections.length ? (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>
              <span style={{marginLeft: '1rem'}}>Parsing PDFs...</span>
            </div>
          ) : combinedSections.length > 0 ? (
            <div style={{...styles.sectionsList, maxHeight: '250px'}}>
              {combinedSections.map(title => (
                <div 
                  key={title} 
                  style={styles.sectionItem}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={selectedSections[title] || false}
                    onChange={() => handleSectionToggle(title)}
                    style={styles.checkbox}
                  />
                  <span style={{fontSize: '0.9rem'}}>{title}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{...styles.emptyState, padding: '2rem 1rem'}}>
              <div style={{...styles.emptyIcon, fontSize: '2.5rem'}}>📋</div>
              <p style={{fontSize: '0.9rem'}}>Upload both PDFs to see sections</p>
            </div>
          )}
        </div>

        {/* Step 3: Compare */}
        <div style={styles.card} className="card-padding">
          <div style={styles.stepHeader('#10b981')}>
            <div style={styles.stepNumber('#10b981')}>3</div>
            <h3 style={styles.stepTitle}>Compare</h3>
          </div>
          
          <div style={{marginBottom: '1.5rem'}}>
            <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
              <input
                type="checkbox"
                checked={onlyNumeric}
                onChange={(e) => setOnlyNumeric(e.target.checked)}
                style={{...styles.checkbox, marginRight: '0.75rem'}}
              />
              <span style={{color: '#374151', fontSize: '0.95rem'}}>Compare only numeric changes</span>
            </label>
          </div>
          
          <button
            onClick={handleCompare}
            disabled={isLoading || !oldPdf || !newPdf}
            style={{
              ...styles.compareButton,
              opacity: (isLoading || !oldPdf || !newPdf) ? 0.5 : 1,
              cursor: (isLoading || !oldPdf || !newPdf) ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (!e.target.disabled) {
                Object.assign(e.target.style, styles.compareButtonHover);
              }
            }}
            onMouseLeave={(e) => {
              if (!e.target.disabled) {
                Object.assign(e.target.style, styles.compareButton);
              }
            }}
          >
            {isLoading ? (
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <div style={styles.spinner}></div>
                <span style={{marginLeft: '0.5rem'}}>Comparing...</span>
              </div>
            ) : (
              '🔍 Compare Selected Sections'
            )}
          </button>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div style={styles.card} className="card-padding">
        <div style={styles.resultsHeader}>
          <h3 style={styles.resultsTitle}>Comparison Results</h3>
          <button
            onClick={handleExport}
            disabled={comparisonResult.length === 0}
            style={{
              ...styles.exportButton,
              opacity: comparisonResult.length === 0 ? 0.5 : 1,
              cursor: comparisonResult.length === 0 ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (!e.target.disabled) {
                Object.assign(e.target.style, styles.exportButtonHover);
              }
            }}
            onMouseLeave={(e) => {
              if (!e.target.disabled) {
                Object.assign(e.target.style, styles.exportButton);
              }
            }}
          >
            📊 Export to Excel
          </button>
        </div>

        {comparisonResult.length > 0 ? (
          <div style={styles.resultsContainer}>
            {comparisonResult.map(({ title, changes }) => (
              <div key={title} style={styles.resultItem}>
                <div style={styles.resultHeader}>
                  📋 {title}
                </div>
                <div style={styles.resultContent}>
                  {changes.map((part, index) => (
                    <div
                      key={index}
                      style={part.added ? styles.diffAdded : part.removed ? styles.diffRemoved : {}}
                    >
                      {part.value.trim().split('\n').map((line, i) => (
                        <div key={i} style={{overflow: 'hidden', wordBreak: 'break-word'}}>
                          <span style={{color: '#6b7280', userSelect: 'none', flexShrink: 0}}>
                            {part.added ? '+ ' : part.removed ? '- ' : '  '}
                          </span>
                          <span style={{wordBreak: 'break-word', whiteSpace: 'pre-wrap'}}>{line}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🔍</div>
            <h4 style={styles.emptyTitle}>Ready to Compare</h4>
            <p style={styles.emptyDescription}>
              Upload two PDFs, select sections, and click "Compare"<br/>
              Results will appear here with highlighted differences
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
);

  const AboutPage = () => (
    <div style={styles.main}>
      <div style={{...styles.card, maxWidth: '800px', margin: '0 auto'}}>
        <div style={{...styles.header, color: '#333', marginBottom: '2rem'}}>
          <h1 style={{...styles.title, color: '#333', fontSize: '2.5rem'}}>About AccuraRate</h1>
          <p style={{...styles.subtitle, color: '#666'}}>
            Powerful, client-side tool designed for the insurance industry
          </p>
        </div>

        <div style={{lineHeight: '1.8', color: '#555', marginBottom: '2rem'}}>
          <p style={{fontSize: '1.1rem', marginBottom: '1.5rem'}}>
            Our application helps underwriters, analysts, and agents quickly identify changes in policy documents, 
            rate sheets, and endorsements, saving valuable time and reducing the risk of manual errors.
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #667eea20, #764ba220)',
          padding: '1.5rem',
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <p style={{fontSize: '1.2rem', fontWeight: '600', color: '#333', margin: 0}}>
            <span style={{color: '#667eea'}}>Developed by</span> TestMasterHub
          </p>
        </div>

        <div style={{borderTop: '2px solid #e5e7eb', paddingTop: '2rem'}}>
          <h2 style={{fontSize: '2rem', fontWeight: '700', color: '#333', marginBottom: '2rem'}}>
            Core Features
          </h2>
          
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem'}}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea10, #667eea05)',
              border: '2px solid #667eea30',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <h3 style={{color: '#667eea', fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center'}}>
                <span style={{marginRight: '0.5rem'}}>🔍</span> Side-by-Side Comparison
              </h3>
              <p style={{color: '#555', lineHeight: '1.6'}}>
                Upload two PDF versions and see the differences highlighted with precision.
              </p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #8b5cf610, #8b5cf605)',
              border: '2px solid #8b5cf630',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <h3 style={{color: '#8b5cf6', fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center'}}>
                <span style={{marginRight: '0.5rem'}}>🤖</span> Intelligent Section Extraction
              </h3>
              <p style={{color: '#555', lineHeight: '1.6'}}>
                Automatically extracts sections from PDF's Table of Contents with page-by-page fallback.
              </p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f5931810, #f5931805)',
              border: '2px solid #f5931830',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <h3 style={{color: '#f59318', fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center'}}>
                <span style={{marginRight: '0.5rem'}}>🔢</span> Numeric-Only Mode
              </h3>
              <p style={{color: '#555', lineHeight: '1.6'}}>
                Isolate and compare only numbers within documents—perfect for rate tables.
              </p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #10b98110, #10b98105)',
              border: '2px solid #10b98130',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <h3 style={{color: '#10b981', fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center'}}>
                <span style={{marginRight: '0.5rem'}}>📊</span> Excel Export
              </h3>
              <p style={{color: '#555', lineHeight: '1.6'}}>
                Download detailed reports of all identified differences in convenient .xlsx format.
              </p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #ef444410, #ef444405)',
              border: '2px solid #ef444430',
              borderRadius: '12px',
              padding: '1.5rem',
              gridColumn: 'span 2'
            }}>
              <h3 style={{color: '#ef4444', fontSize: '1.3rem', marginBottom: '1rem', display: 'flex', alignItems: 'center'}}>
                <span style={{marginRight: '0.5rem'}}>🛡️</span> Secure & Private
              </h3>
              <p style={{color: '#555', lineHeight: '1.6'}}>
                All processing is done directly in your browser. Your documents are never uploaded to a server, 
                ensuring complete privacy and security.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const PrivacyPage = () => (
    <div style={styles.main}>
      <div style={{...styles.card, maxWidth: '800px', margin: '0 auto'}}>
        <div style={{...styles.header, color: '#333', marginBottom: '2rem'}}>
          <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🛡️</div>
          <h1 style={{...styles.title, color: '#333', fontSize: '2.5rem'}}>Privacy Policy</h1>
          <p style={{...styles.subtitle, color: '#666'}}>
            Your privacy and data security are our highest priorities
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #10b98120, #10b98110)',
          border: '2px solid #10b98140',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{color: '#065f46', fontSize: '1.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center'}}>
            <span style={{marginRight: '0.75rem'}}>✅</span> No Data Collection
          </h2>
          <div style={{color: '#047857', lineHeight: '1.8'}}>
            <p style={{marginBottom: '1rem'}}>
              AccuraRate is designed with your privacy as its top priority. We do not collect, store, or transmit 
              any personal data or any content from the PDF documents you upload.
            </p>
            <p>
              All PDF processing and comparison tasks are performed locally within your web browser using JavaScript. 
              Your files are never sent to our servers or any third-party service. Once you close the browser tab, 
              all session data is permanently deleted.
            </p>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #3b82f620, #3b82f610)',
          border: '2px solid #3b82f640',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{color: '#1e40af', fontSize: '1.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center'}}>
            <span style={{marginRight: '0.75rem'}}>💻</span> Open Source Commitment
          </h2>
          <div style={{color: '#1e3a8a', lineHeight: '1.8'}}>
            <p style={{marginBottom: '1rem'}}>
              We believe in transparency. AccuraRate is an open-source project. You are free to review the source code 
              to verify our privacy claims and contribute to its development.
            </p>
            <p>
              You can find the complete source code on our{' '}
              <a 
                href="https://github.com/example/accurarate" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: '#1d4ed8', 
                  fontWeight: '600', 
                  textDecoration: 'underline',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#1e40af'}
                onMouseLeave={(e) => e.target.style.color = '#1d4ed8'}
              >
                GitHub repository
              </a>.
            </p>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #6b728020, #6b728010)',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <h3 style={{color: '#374151', fontSize: '1.4rem', fontWeight: '700', marginBottom: '0.5rem'}}>
            Complete Browser-Based Processing
          </h3>
          <p style={{color: '#6b7280', margin: 0, lineHeight: '1.6'}}>
            Every operation happens locally in your browser. No server uploads, no data tracking, no privacy concerns.
          </p>
        </div>
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
      {/* Add CSS animation for spinner */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Navigation */}
      <nav style={styles.navbar}>
        <div style={styles.navContainer}>
          <div
            onClick={() => setPage('home')}
            style={styles.logo}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            AccuraRate
          </div>
          
          <div style={styles.navButtons}>
            {[
              { id: 'home', label: '🏠 Home' },
              { id: 'about', label: 'ℹ️ About' },
              { id: 'privacy', label: '🛡️ Privacy' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                style={styles.navButton(page === item.id)}
                onMouseEnter={(e) => {
                  if (page !== item.id) {
                    e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                    e.target.style.color = '#667eea';
                  }
                }}
                onMouseLeave={(e) => {
                  if (page !== item.id) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.color = '#333';
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {renderPage()}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem'}}>
            <div style={{fontSize: '1.8rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #ffffff, #e0e7ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}>
              AccuraRate
            </div>
          </div>
          
          <p style={{marginBottom: '0.5rem', opacity: 0.9}}>
            © {new Date().getFullYear()} AccuraRate. Developed by{' '}
            <span style={{fontWeight: '600', color: '#a5b4fc'}}>TestMasterHub</span>. All Rights Reserved.
          </p>
          
          <p style={{fontSize: '0.9rem', opacity: 0.7, marginBottom: '1rem'}}>
            AccuraRate is an open-source project. Visit us on{' '}
            <a 
              href="https://github.com/example/accurarate" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{color: '#a5b4fc', textDecoration: 'underline'}}
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