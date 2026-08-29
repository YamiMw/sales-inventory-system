/**
 * Export Commerce Handlers
 * Registers focused authenticated commerce IPC handlers.
 */

'use strict';

function registerCommerceExportHandlers(context) {
  const {
    secureIpc,
    logger,
    dialog,
    BrowserWindow,
    getMainWindow,
    documentPdfCssPath,
    documentLogoPath,
    fs
  } = context;

  secureIpc.handle('export-document-pdf', async (event, request = 'document') => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Main window is not available');
      }

      const payload = request && typeof request === 'object'
        ? request
        : { documentNumber: request };
      const documentNumber = payload.documentNumber || 'document';
      const safeName = String(documentNumber || 'document').replace(/[<>:"/\\|?*]/g, '-');
      const result = await dialog.showSaveDialog(mainWindow, {
        title: payload.dialogTitle || 'Export PDF',
        defaultPath: `${safeName}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      let pdfData;
      const isLandscape = Boolean(payload.landscape);
      if (payload.html && BrowserWindow) {
        const pdfWindow = new BrowserWindow({
          show: false,
          width: isLandscape ? 1123 : 794,
          height: isLandscape ? 794 : 1123,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
          }
        });

        try {
          const pdfCss = documentPdfCssPath && fs.existsSync(documentPdfCssPath)
            ? fs.readFileSync(documentPdfCssPath, 'utf8')
            : '';
          let documentHtml = String(payload.html || '');
          if (documentLogoPath && fs.existsSync(documentLogoPath)) {
            const logoData = fs.readFileSync(documentLogoPath).toString('base64');
            const logoUri = `data:image/png;base64,${logoData}`;
            documentHtml = documentHtml.replace(
              /src=(["'])([^"']*resources\/logo\.png)\1/gi,
              `src="${logoUri}"`
            );
          }
          const pdfHtml = payload.fullHtml
            ? documentHtml
            : `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeName}</title>
  <style>${pdfCss}</style>
</head>
<body>
  <main class="pdf-document-root">${documentHtml}</main>
</body>
</html>`;

          await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pdfHtml)}`);
          await pdfWindow.webContents.executeJavaScript(`
            Promise.all([
              document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
              Promise.all(Array.from(document.images).map(img => img.complete
                ? Promise.resolve()
                : new Promise(resolve => {
                    img.addEventListener('load', resolve, { once: true });
                    img.addEventListener('error', resolve, { once: true });
                  })))
            ]).then(() => true)
          `);
          pdfData = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            landscape: isLandscape,
            preferCSSPageSize: true,
            marginsType: 1
          });
        } finally {
          if (!pdfWindow.isDestroyed()) {
            pdfWindow.destroy();
          }
        }
      } else {
        pdfData = await mainWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          landscape: isLandscape
        });
      }
      fs.writeFileSync(result.filePath, pdfData);

      return { success: true, data: { filePath: result.filePath } };
    } catch (error) {
      logger.error('Export document PDF error:', error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerCommerceExportHandlers };
