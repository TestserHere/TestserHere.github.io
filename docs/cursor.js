  const backAllCursors = (parent) => {
    Array.from(parent.children).forEach((element) => {
      // backup original cursor, if not backed up already
      if (!element.getAttribute('data-macos-cursor')) {
        const macOsCursor = getComputedStyle(element).cursor;

        if (macOsCursor) {
          element.setAttribute('data-macos-cursor', macOsCursor);
          element.setAttribute('data-system-cursor', macOsCursor.split(',').pop().trim()); // => pointer
        } else {
          element.setAttribute('data-macos-cursor', 'auto');
          element.setAttribute('data-system-cursor', 'auto');
        }
      }

      // recursively
      backAllCursors(element);
    });
  }

  function setCursor(cursor) {
    const setChildrenCursor = (parent, cursor) => {
      Array.from(parent.children).forEach((element) => {
        if (cursor === "ipadOS") {
          element.style.setProperty('cursor', 'none', 'important');
        } else if (cursor === "macOS") {
          element.style.setProperty('cursor', element.getAttribute('data-macos-cursor'), 'important');
        } else if (cursor === "system") {
          element.style.setProperty('cursor', element.getAttribute('data-system-cursor'), 'important');
        }

        // recursively
        setChildrenCursor(element, cursor);
      })
    }

    // set browser cursor
    setChildrenCursor(document.body, cursor);

    // set fake cursor
    if (cursor === "ipadOS") {
      import("https://unpkg.com/ipad-cursor@latest").then(cursorModule => {
        cursorModule.initCursor();
      });
    } else {
      import("https://unpkg.com/ipad-cursor@latest").then(cursorModule => {
        cursorModule.disposeCursor();
      }); 
    }

    // set iframe cursor
    document.querySelectorAll('iframe').forEach((iframe) => {
        try {
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage(
                    { type: 'setCursor', value: cursor },
                    '*'
                );
            } else {
                console.warn('iframe.contentWindow is not available');
            }
        } catch (e) {
            console.warn('Could not postMessage to iframe:', e);
        }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    backAllCursors(document.body);
  });

  window.addEventListener('message', (event) => {
    if (event.data.type === 'setCursor') {
        setCursor(event.data.value);
    }
  });

