import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Loader2,
  FileWarning,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { getPresentationUrl } from '@/lib/gameApi';

interface PresentationViewerProps {
  path: string;
  currentPage: number;
  totalPages: number | null;
  fullscreenRef?: React.RefObject<HTMLDivElement>;
  showFullscreenButton?: boolean;
  onPageChange?: (page: number) => void | Promise<void>;
}

interface PdfLink {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  url?: string;
  page?: number;
  action?: string;
}

function resolveAnnotationUrl(annotation: any): string | null {
  if (
    typeof annotation.url === 'string' &&
    annotation.url.trim()
  ) {
    return annotation.url.trim();
  }

  const raw =
    typeof annotation.unsafeUrl === 'string'
      ? annotation.unsafeUrl.trim()
      : '';

  if (!raw) {
    return null;
  }

  if (/^(https?:|mailto:|tel:)/i.test(raw)) {
    return raw;
  }

  if (/^www\./i.test(raw)) {
    return `https://${raw}`;
  }

  if (
    /^[\w-]+(\.[\w-]+)+(\/[^\s]*)?$/i.test(raw)
  ) {
    return `https://${raw}`;
  }

  return null;
}

async function resolveDestinationPage(
  pdfDoc: any,
  destination: any
): Promise<number | null> {
  if (destination == null) {
    return null;
  }

  if (typeof destination === 'string') {
    try {
      const resolved =
        await pdfDoc.getDestination(destination);

      if (!resolved) {
        return null;
      }

      return resolveDestinationPage(
        pdfDoc,
        resolved
      );
    } catch (e) {
      console.error(
        '[PresentationViewer] Failed to resolve named destination:',
        destination,
        e
      );

      return null;
    }
  }

  if (Array.isArray(destination)) {
    if (!destination.length) {
      return null;
    }

    const pageRef = destination[0];

    if (Number.isInteger(pageRef)) {
      const page = pageRef + 1;

      return page >= 1 &&
        page <= pdfDoc.numPages
        ? page
        : null;
    }

    if (
      pageRef &&
      typeof pageRef === 'object' &&
      Number.isInteger(pageRef.num) &&
      Number.isInteger(pageRef.gen)
    ) {
      try {
        const pageIndex =
          await pdfDoc.getPageIndex(pageRef);

        const page = pageIndex + 1;

        return page >= 1 &&
          page <= pdfDoc.numPages
          ? page
          : null;
      } catch (e) {
        console.error(
          '[PresentationViewer] Failed to resolve page reference:',
          pageRef,
          e
        );
      }
    }

    return null;
  }

  if (
    typeof destination === 'object' &&
    Number.isInteger(destination.num) &&
    Number.isInteger(destination.gen)
  ) {
    try {
      const pageIndex =
        await pdfDoc.getPageIndex(destination);

      const page = pageIndex + 1;

      return page >= 1 &&
        page <= pdfDoc.numPages
        ? page
        : null;
    } catch (e) {
      console.error(
        '[PresentationViewer] Failed to resolve raw page reference:',
        destination,
        e
      );
    }
  }

  return null;
}

function getAnnotationDestination(
  annotation: any
): any {
  if (annotation?.dest != null) {
    return annotation.dest;
  }

  const action = annotation?.action;

  if (
    !action ||
    typeof action !== 'object'
  ) {
    return null;
  }

  if (action.dest != null) {
    return action.dest;
  }

  if (action.D != null) {
    return action.D;
  }

  return null;
}

export function PresentationViewer({
  path,
  currentPage,
  totalPages,
  fullscreenRef,
  showFullscreenButton = false,
  onPageChange,
}: PresentationViewerProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const pdfWrapperRef =
    useRef<HTMLDivElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const linkLayerRef =
    useRef<HTMLDivElement>(null);

  const renderTaskRef =
    useRef<any>(null);

  const renderGenRef =
    useRef(0);

  const resizeFrameRef =
    useRef<number | null>(null);

  const resizeTimeoutRef =
    useRef<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [pdfDoc, setPdfDoc] =
    useState<any>(null);

  const [isFullscreen, setIsFullscreen] =
    useState(false);

  const [links, setLinks] =
    useState<PdfLink[]>([]);

  const url = getPresentationUrl(path);

  const isPdf =
    path.toLowerCase().endsWith('.pdf');

  // ------------------------------------------------------------
  // LOAD PDF
  // ------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    setLinks([]);
    setPdfDoc(null);
    setError(null);

    if (!isPdf) {
      setLoading(false);
      return;
    }

    setLoading(true);

    (async () => {
      try {
        const pdfjs =
          await import('pdfjs-dist');

        pdfjs.GlobalWorkerOptions.workerSrc =
          new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
          ).toString();

        const doc =
          await pdfjs.getDocument({
            url,
            withCredentials: false,
          }).promise;

        if (cancelled) {
          return;
        }

        setPdfDoc(doc);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) {
          return;
        }

        console.error(
          '[PresentationViewer] PDF load failed:',
          e
        );

        setError(
          `Failed to load presentation: ${
            e?.message || String(e)
          }`
        );

        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, isPdf]);

  // ------------------------------------------------------------
  // RENDER CURRENT PAGE
  // ------------------------------------------------------------

  const renderPage = useCallback(
    async () => {
      if (
        !pdfDoc ||
        !canvasRef.current ||
        !containerRef.current ||
        !pdfWrapperRef.current
      ) {
        return;
      }

      const canvas =
        canvasRef.current;

      const ctx =
        canvas.getContext('2d');

      if (!ctx) {
        return;
      }

      const myGen =
        ++renderGenRef.current;

      // Cancel previous PDF render.
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors.
        }

        renderTaskRef.current = null;
      }

      try {
        const page =
          await pdfDoc.getPage(currentPage);

        if (
          myGen !==
          renderGenRef.current
        ) {
          return;
        }

        const container =
          containerRef.current;

        const wrapper =
          pdfWrapperRef.current;

        if (!container || !wrapper) {
          return;
        }

        /*
         * IMPORTANT:
         *
         * The fullscreen element may be a parent of this
         * component. Therefore we measure the actual viewer
         * container every time rather than trusting previous
         * canvas dimensions.
         */
        const containerWidth =
          container.clientWidth;

        const containerHeight =
          container.clientHeight;

        if (
          containerWidth <= 0 ||
          containerHeight <= 0
        ) {
          return;
        }

        const baseViewport =
          page.getViewport({
            scale: 1,
          });

        const scale = Math.min(
          containerWidth /
            baseViewport.width,
          containerHeight /
            baseViewport.height
        );

        const viewport =
          page.getViewport({
            scale: Math.max(
              scale,
              0.1
            ),
          });

        const devicePixelRatio =
          Math.min(
            window.devicePixelRatio || 1,
            2
          );

        const cssWidth =
          Math.floor(viewport.width);

        const cssHeight =
          Math.floor(viewport.height);

        /*
         * Set the wrapper size explicitly.
         *
         * This prevents it from retaining the fullscreen
         * dimensions after fullscreen is exited.
         */
        wrapper.style.width =
          `${cssWidth}px`;

        wrapper.style.height =
          `${cssHeight}px`;

        wrapper.style.maxWidth =
          '100%';

        wrapper.style.maxHeight =
          '100%';

        wrapper.style.flex =
          '0 0 auto';

        wrapper.style.margin =
          '0 auto';

        /*
         * Reset canvas dimensions on every render.
         */
        canvas.width =
          Math.ceil(
            viewport.width *
              devicePixelRatio
          );

        canvas.height =
          Math.ceil(
            viewport.height *
              devicePixelRatio
          );

        canvas.style.width =
          `${cssWidth}px`;

        canvas.style.height =
          `${cssHeight}px`;

        canvas.style.display =
          'block';

        canvas.style.maxWidth =
          'none';

        canvas.style.maxHeight =
          'none';

        if (linkLayerRef.current) {
          linkLayerRef.current.style.width =
            `${cssWidth}px`;

          linkLayerRef.current.style.height =
            `${cssHeight}px`;
        }

        ctx.setTransform(
          devicePixelRatio,
          0,
          0,
          devicePixelRatio,
          0,
          0
        );

        ctx.clearRect(
          0,
          0,
          viewport.width,
          viewport.height
        );

        const task =
          page.render({
            canvasContext: ctx,
            viewport,
          });

        renderTaskRef.current =
          task;

        await task.promise;

        if (
          renderTaskRef.current ===
          task
        ) {
          renderTaskRef.current =
            null;
        }

        if (
          myGen !==
          renderGenRef.current
        ) {
          return;
        }

        // ------------------------------------------------------
        // READ PDF ANNOTATIONS
        // ------------------------------------------------------

        const annotations =
          await page.getAnnotations({
            intent: 'display',
          });

        if (
          myGen !==
          renderGenRef.current
        ) {
          return;
        }

        const nextLinks: PdfLink[] =
          [];

        for (
          let i = 0;
          i < annotations.length;
          i++
        ) {
          const annotation: any =
            annotations[i];

          try {
            if (
              !annotation ||
              !Array.isArray(
                annotation.rect
              ) ||
              annotation.rect.length !== 4
            ) {
              continue;
            }

            const [x1, y1, x2, y2] =
              viewport.convertToViewportRectangle(
                annotation.rect
              );

            const left =
              Math.min(x1, x2);

            const top =
              Math.min(y1, y2);

            const width =
              Math.abs(x2 - x1);

            const height =
              Math.abs(y2 - y1);

            if (
              width <= 0 ||
              height <= 0
            ) {
              continue;
            }

            const baseLink = {
              id: String(
                annotation.id ||
                  `pdf-link-${currentPage}-${i}`
              ),
              left,
              top,
              width,
              height,
            };

            // External URL.
            const externalUrl =
              resolveAnnotationUrl(
                annotation
              );

            if (externalUrl) {
              nextLinks.push({
                ...baseLink,
                url: externalUrl,
              });

              continue;
            }

            // Internal PDF link.
            const destination =
              getAnnotationDestination(
                annotation
              );

            if (
              destination != null
            ) {
              const targetPage =
                await resolveDestinationPage(
                  pdfDoc,
                  destination
                );

              if (
                targetPage != null &&
                targetPage >= 1 &&
                targetPage <=
                  pdfDoc.numPages
              ) {
                nextLinks.push({
                  ...baseLink,
                  page: targetPage,
                });

                continue;
              }
            }

            // PDF named actions.
            let actionName:
              | string
              | null = null;

            if (
              typeof annotation.action ===
              'string'
            ) {
              actionName =
                annotation.action;
            } else if (
              annotation.action &&
              typeof annotation.action ===
                'object'
            ) {
              if (
                typeof annotation.action
                  .action === 'string'
              ) {
                actionName =
                  annotation.action.action;
              } else if (
                typeof annotation.action
                  .name === 'string'
              ) {
                actionName =
                  annotation.action.name;
              }
            }

            if (actionName) {
              const normalizedAction =
                actionName.replace(
                  /^GoTo$/,
                  ''
                );

              if (
                normalizedAction ===
                  'NextPage' ||
                normalizedAction ===
                  'PrevPage' ||
                normalizedAction ===
                  'FirstPage' ||
                normalizedAction ===
                  'LastPage'
              ) {
                nextLinks.push({
                  ...baseLink,
                  action:
                    normalizedAction,
                });
              }
            }
          } catch (annotationError) {
            console.error(
              '[PresentationViewer] Failed to process PDF annotation:',
              annotationError
            );
          }
        }

        setLinks(nextLinks);
      } catch (e: any) {
        if (
          e?.name ===
          'RenderingCancelledException'
        ) {
          return;
        }

        console.error(
          '[PresentationViewer] page render error:',
          e
        );
      }
    },
    [pdfDoc, currentPage]
  );

  // ------------------------------------------------------------
  // INITIAL / PAGE RENDER
  // ------------------------------------------------------------

  useEffect(() => {
    if (!pdfDoc) {
      return;
    }

    void renderPage();
  }, [
    pdfDoc,
    currentPage,
    renderPage,
  ]);

  // ------------------------------------------------------------
  // RESIZE / FULLSCREEN RE-RENDER
  // ------------------------------------------------------------

  useEffect(() => {
    if (
      !pdfDoc ||
      !containerRef.current
    ) {
      return;
    }

    const container =
      containerRef.current;

    const fullscreenElement =
      fullscreenRef?.current;

    const scheduleRender =
      () => {
        if (
          resizeFrameRef.current !==
          null
        ) {
          cancelAnimationFrame(
            resizeFrameRef.current
          );
        }

        resizeFrameRef.current =
          requestAnimationFrame(() => {
            resizeFrameRef.current =
              null;

            void renderPage();
          });
      };

    const resizeObserver =
      new ResizeObserver(() => {
        scheduleRender();
      });

    /*
     * Observe the actual viewer.
     */
    resizeObserver.observe(
      container
    );

    /*
     * Also observe the fullscreen parent.
     *
     * This is important because fullscreenRef can point to
     * a parent whose dimensions change while the PDF viewer
     * itself temporarily keeps its old dimensions.
     */
    if (
      fullscreenElement &&
      fullscreenElement !== container
    ) {
      resizeObserver.observe(
        fullscreenElement
      );
    }

    /*
     * Window resize catches browser fullscreen transitions
     * that don't immediately trigger ResizeObserver.
     */
    const handleWindowResize =
      () => {
        scheduleRender();
      };

    window.addEventListener(
      'resize',
      handleWindowResize
    );

    return () => {
      resizeObserver.disconnect();

      window.removeEventListener(
        'resize',
        handleWindowResize
      );

      if (
        resizeFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          resizeFrameRef.current
        );

        resizeFrameRef.current =
          null;
      }
    };
  }, [
    pdfDoc,
    renderPage,
    fullscreenRef,
  ]);

  // ------------------------------------------------------------
  // FULLSCREEN
  // ------------------------------------------------------------

  const toggleFullscreen =
    useCallback(() => {
      const element =
        fullscreenRef?.current ||
        containerRef.current;

      if (!element) {
        return;
      }

      if (!document.fullscreenElement) {
        element
          .requestFullscreen?.()
          .catch((e) => {
            console.error(
              '[PresentationViewer] Failed to enter fullscreen:',
              e
            );
          });
      } else {
        document
          .exitFullscreen?.()
          .catch((e) => {
            console.error(
              '[PresentationViewer] Failed to exit fullscreen:',
              e
            );
          });
      }
    }, [fullscreenRef]);

  /*
   * This is the important fullscreen fix.
   *
   * We DON'T try to cancel an animation frame using the render
   * generation counter.
   *
   * Instead we wait until the browser has completely finished
   * changing fullscreen layout, then render using the NEW
   * container dimensions.
   */
  useEffect(() => {
    const handleFullscreenChange =
      () => {
        const fullscreen =
          !!document.fullscreenElement;

        setIsFullscreen(fullscreen);

        if (!pdfDoc) {
          return;
        }

        /*
         * Clear any pending delayed resize.
         */
        if (
          resizeFrameRef.current !==
          null
        ) {
          cancelAnimationFrame(
            resizeFrameRef.current
          );

          resizeFrameRef.current =
            null;
        }

        if (
          resizeTimeoutRef.current !==
          null
        ) {
          window.clearTimeout(
            resizeTimeoutRef.current
          );

          resizeTimeoutRef.current =
            null;
        }

        /*
         * Give the browser several layout opportunities.
         *
         * The final render is based on clientWidth/clientHeight,
         * never on the previous canvas size.
         */
        let frame = 0;

        const renderAfterLayout =
          () => {
            frame++;

            if (frame < 4) {
              requestAnimationFrame(
                renderAfterLayout
              );

              return;
            }

            void renderPage();
          };

        requestAnimationFrame(
          renderAfterLayout
        );

        /*
         * Extra fallback for browsers where the fullscreen
         * transition settles slightly later.
         */
        resizeTimeoutRef.current =
          window.setTimeout(() => {
            resizeTimeoutRef.current =
              null;

            void renderPage();
          }, 150);
      };

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      );

      if (
        resizeTimeoutRef.current !==
        null
      ) {
        window.clearTimeout(
          resizeTimeoutRef.current
        );

        resizeTimeoutRef.current =
          null;
      }
    };
  }, [
    pdfDoc,
    renderPage,
  ]);

  // ------------------------------------------------------------
  // HANDLE PDF LINK CLICK
  // ------------------------------------------------------------

  const handleLinkClick =
    useCallback(
      async (
        event: React.MouseEvent<HTMLAnchorElement>,
        link: PdfLink
      ) => {
        if (link.url) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (link.page != null) {
          if (
            link.page === currentPage
          ) {
            return;
          }

          try {
            await onPageChange?.(
              link.page
            );
          } catch (e) {
            console.error(
              '[PresentationViewer] Internal PDF navigation failed:',
              e
            );
          }

          return;
        }

        if (link.action) {
          let targetPage:
            | number
            | null = null;

          const maxPage =
            pdfDoc?.numPages ||
            totalPages ||
            currentPage;

          switch (link.action) {
            case 'NextPage':
              targetPage = Math.min(
                maxPage,
                currentPage + 1
              );
              break;

            case 'PrevPage':
              targetPage = Math.max(
                1,
                currentPage - 1
              );
              break;

            case 'FirstPage':
              targetPage = 1;
              break;

            case 'LastPage':
              targetPage = maxPage;
              break;
          }

          if (
            targetPage != null &&
            targetPage !== currentPage
          ) {
            try {
              await onPageChange?.(
                targetPage
              );
            } catch (e) {
              console.error(
                '[PresentationViewer] PDF action navigation failed:',
                e
              );
            }
          }
        }
      },
      [
        currentPage,
        onPageChange,
        pdfDoc,
        totalPages,
      ]
    );

  // ------------------------------------------------------------
  // SPACE KEY
  // ------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.code !== 'Space' &&
          event.key !== ' '
        ) {
          return;
        }

        if (!document.fullscreenElement) {
          return;
        }

        event.preventDefault();
      };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, []);

  // ------------------------------------------------------------
  // NON-PDF FALLBACK
  // ------------------------------------------------------------

  if (!isPdf) {
    return (
      <div
        ref={containerRef}
        className="relative w-full h-full min-w-0 min-h-0 flex items-center justify-center bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden"
      >
        <div className="text-center p-8">
          <FileWarning className="w-12 h-12 text-amber-400 mx-auto mb-4" />

          <p className="text-white font-semibold mb-2">
            Presentation file ready
          </p>

          <p className="text-slate-400 text-sm mb-4">
            This file type cannot be rendered
            inline. Players can download it.
          </p>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm"
          >
            Open file
          </a>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // PDF VIEWER
  // ------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-w-0 min-h-0 flex items-center justify-center bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden"
    >
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-900">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />

          <p className="text-slate-400 text-sm">
            Loading presentation...
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
          <FileWarning className="w-12 h-12 text-red-400" />

          <p className="text-red-300 font-semibold">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <div
          ref={pdfWrapperRef}
          className="relative flex-shrink-0 leading-none"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            margin: '0 auto',
            flex: '0 0 auto',
          }}
        >
          <canvas
            ref={canvasRef}
            className="block"
          />

          {/* Transparent PDF hyperlink layer */}
          <div
            ref={linkLayerRef}
            className="absolute left-0 top-0 pointer-events-none"
          >
            {links.map((link) => (
              <a
                key={link.id}
                href={
                  link.url || '#'
                }
                target={
                  link.url
                    ? '_blank'
                    : undefined
                }
                rel={
                  link.url
                    ? 'noopener noreferrer'
                    : undefined
                }
                title={
                  link.url
                    ? link.url
                    : link.page != null
                      ? `Go to page ${link.page}`
                      : link.action ||
                        'PDF link'
                }
                aria-label={
                  link.url
                    ? link.url
                    : link.page != null
                      ? `Go to page ${link.page}`
                      : link.action ||
                        'PDF link'
                }
                onClick={(event) =>
                  handleLinkClick(
                    event,
                    link
                  )
                }
                className="absolute pointer-events-auto cursor-pointer rounded-sm hover:bg-blue-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                style={{
                  left: `${link.left + 3}px`,
                  top: `${link.top + 3}px`,
                  width: `${Math.max(
                    link.width - 6,
                    1
                  )}px`,
                  height: `${Math.max(
                    link.height - 6,
                    1
                  )}px`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen button */}
      {showFullscreenButton &&
        !loading &&
        !error && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 z-30 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors backdrop-blur-sm"
            title={
              isFullscreen
                ? 'Exit fullscreen'
                : 'Fullscreen'
            }
            type="button"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
        )}

      {/* Page counter */}
      {totalPages != null &&
        totalPages > 0 && (
          <div className="absolute bottom-3 right-3 z-30 px-3 py-1 bg-slate-800/80 text-slate-400 text-sm font-mono rounded-lg backdrop-blur-sm">
            {currentPage} / {totalPages}
          </div>
        )}
    </div>
  );
}