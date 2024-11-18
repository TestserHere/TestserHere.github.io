// window.addEventListener('DOMContentLoaded', event => {

//     var modal = new bootstrap.Modal(document.getElementById('exampleModal'));
//     modal.show();


//     // Navbar shrink function
//     var navbarShrink = function () {
//         const navbarCollapsible = document.body.querySelector('#mainNav');
//         if (!navbarCollapsible) {
//             return;
//         }
//         if (window.scrollY === 0) {
//             navbarCollapsible.classList.remove('navbar-shrink')
//         } else {
//             navbarCollapsible.classList.add('navbar-shrink')
//         }

//     };

//     // Shrink the navbar 
//     navbarShrink();

//     // Shrink the navbar when page is scrolled
//     document.addEventListener('scroll', navbarShrink);

//     // Activate Bootstrap scrollspy on the main nav element
//     const mainNav = document.body.querySelector('#mainNav');
//     if (mainNav) {
//         new bootstrap.ScrollSpy(document.body, {
//             target: '#mainNav',
//             rootMargin: '0px 0px -40%',
//         });
//     };

//     // Collapse responsive navbar when toggler is visible
//     const navbarToggler = document.body.querySelector('.navbar-toggler');
//     const responsiveNavItems = [].slice.call(
//         document.querySelectorAll('#navbarResponsive .nav-link')
//     );
//     responsiveNavItems.map(function (responsiveNavItem) {
//         responsiveNavItem.addEventListener('click', () => {
//             if (window.getComputedStyle(navbarToggler).display !== 'none') {
//                 navbarToggler.click();
//             }
//         });
//     });

//     // Activate SimpleLightbox plugin for portfolio items
//     new SimpleLightbox({
//         elements: '#portfolio a.portfolio-box'
//     });

// });

// document.addEventListener('DOMContentLoaded', function () {
//     const mainModal = new bootstrap.Modal(document.getElementById('exampleModal'));
//     const previewModal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
//     const previewImage = document.getElementById('previewImage');

//     // // Check if the user has already seen the modal
//     // if (localStorage.getItem('hasSeenModal') === 'true') {
//     //     return; // Don't show the modal if it has already been seen
//     // }

//     // // Open the main modal if the user hasn't seen it
//     // mainModal.show();



//     // Reopen main modal when preview modal is dismissed
//     document.getElementById('imagePreviewModal').addEventListener('hidden.bs.modal', function () {
//         mainModal.show();
//     });

//     // When the modal is closed, store in localStorage to prevent future showing
//     document.querySelector('.btn-close').addEventListener('click', function () {
//         localStorage.setItem('hasSeenModal', 'true');
//     });

//     // Ensure backdrops are removed after modals are hidden
//     function removeBackdrops() {
//         document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
//     }
//     document.getElementById('exampleModal').addEventListener('hidden.bs.modal', removeBackdrops);
//     document.getElementById('imagePreviewModal').addEventListener('hidden.bs.modal', removeBackdrops);
// });

/*!
* Start Bootstrap - Creative v7.0.7 (https://startbootstrap.com/theme/creative)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-creative/blob/master/LICENSE)
*/
//
// Scripts
// 

document.addEventListener('DOMContentLoaded', () => {
    // Bootstrap Modals
    const mainModal = new bootstrap.Modal(document.getElementById('exampleModal'));
    const previewModal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
    const previewImage = document.getElementById('previewImage');



    // Activate Bootstrap scrollspy
    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            rootMargin: '0px 0px -40%',
        });
    }

    // Collapse responsive navbar
    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = Array.from(document.querySelectorAll('#navbarResponsive .nav-link'));
    responsiveNavItems.forEach((responsiveNavItem) => {
        responsiveNavItem.addEventListener('click', () => {
            if (window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });

    // Activate SimpleLightbox for portfolio items
    const a = new SimpleLightbox({
        elements: '#portfolio a.portfolio-box',
    });
    console.log(11, SimpleLightbox, a)

    mainModal.show();

    // Handle preview image modal
    const showImagePreview = (imageSrc) => {
        if (previewImage) {
            previewImage.src = imageSrc;
            previewModal.show();
        }
    };

    // Add event listeners to image thumbnails for preview
    const imageThumbnails = document.querySelectorAll('.image-thumbnail'); // Update this selector as needed
    imageThumbnails.forEach((thumbnail) => {
        thumbnail.addEventListener('click', () => {
            const imageSrc = thumbnail.getAttribute('data-full-image'); // Update the attribute as per your structure
            showImagePreview(imageSrc);
        });
    });

    // Reopen main modal when preview modal is dismissed
    document.getElementById('imagePreviewModal').addEventListener('hidden.bs.modal', () => {
        mainModal.show();
    });

    // Store modal visibility state
    document.querySelector('.btn-close').addEventListener('click', () => {
        localStorage.setItem('hasSeenModal', 'true');
    });

    // Remove backdrops after modals are hidden
    const removeBackdrops = () => {
        document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
    };
    document.getElementById('exampleModal').addEventListener('hidden.bs.modal', removeBackdrops);
    document.getElementById('imagePreviewModal').addEventListener('hidden.bs.modal', removeBackdrops);
});


