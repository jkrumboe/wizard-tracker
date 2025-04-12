// Register service worker for PWA functionality
export function register() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        const swUrl = `${window.location.origin}/service-worker.js`
  
        navigator.serviceWorker
          .register(swUrl)
          .then((registration) => {
            console.log("ServiceWorker registration successful with scope: ", registration.scope)
          })
          .catch((error) => {
            console.error("ServiceWorker registration failed: ", error)
          })
      })
    }
  }
  
  export function unregister() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.unregister()
        })
        .catch((error) => {
          console.error(error.message)
        })
    }
  }
  
  