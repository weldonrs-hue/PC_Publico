let sharedClientPromise: any = null;

export async function getUDocClient(): Promise<any> {
  if (typeof window === 'undefined') return null;

  if (!sharedClientPromise) {
    sharedClientPromise = (async () => {
      try {
        const { UDocClient } = await import('@docmentis/udoc-viewer');
        
        const initOptions = {
          googleFonts: true,
          locale: 'pt-BR',
          enablePerformanceCounter: false,
        };

        // Try local assets first with a more robust absolute URL
        const localBaseUrl = window.location.origin + '/udoc-viewer/';
        console.log('[udoc] Initializing with local assets:', localBaseUrl);
        
        try {
          const client = await UDocClient.create({
            ...initOptions,
            baseUrl: localBaseUrl
          });
          console.log('[udoc] Initialization successful with local assets');
          return client;
        } catch (localErr) {
          console.warn('[udoc] Local assets failed, trying fallback source...', localErr);
          // Fallback to CDN if local fails
          const fallbackClient = await UDocClient.create(initOptions);
          return fallbackClient;
        }
      } catch (err) {
        console.error('[udoc] Critical initialization error:', err);
        throw err;
      }
    })();
  }

  return sharedClientPromise;
}
