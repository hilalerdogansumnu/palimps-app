/**
 * Accessibility utilities for PALIMPS
 * Provides consistent accessibility labels and hints across the app
 */

export const a11y = {
  // Navigation
  backButton: {
    label: "Go back",
    hint: "Returns to the previous screen",
  },
  closeButton: {
    label: "Close",
    hint: "Closes this dialog or screen",
  },

  // Books
  addBook: {
    label: "Add new book",
    hint: "Opens form to add a new book to your library",
  },
  bookCard: (title: string) => ({
    label: `Book: ${title}`,
    hint: "Double tap to view details",
  }),
  deleteBook: {
    label: "Delete book",
    hint: "Removes this book from your library",
  },

  // Moments
  addMoment: {
    label: "Add new reading moment",
    hint: "Capture a new page or passage from this book",
  },
  momentCard: (date: string) => ({
    label: `Reading moment from ${date}`,
    hint: "Double tap to view full details",
  }),
  deleteMoment: {
    label: "Delete reading moment",
    hint: "Removes this moment from your library",
  },
  editMoment: {
    label: "Edit reading moment",
    hint: "Modify the text or notes for this moment",
  },

  // Photo
  takePhoto: {
    label: "Take photo",
    hint: "Opens camera to capture a new photo",
  },
  selectPhoto: {
    label: "Select from library",
    hint: "Choose a photo from your device library",
  },
  cropPhoto: {
    label: "Crop photo",
    hint: "Adjust the crop area for this photo",
  },

  // OCR
  ocrEdit: {
    label: "Edit OCR text",
    hint: "Modify the extracted text from the photo",
  },
  fontSize: {
    label: "Font size",
    hint: "Choose small, normal, or large text size",
  },
  alignment: {
    label: "Text alignment",
    hint: "Choose left, center, right, or justified alignment",
  },
  style: {
    label: "Text style",
    hint: "Choose normal, italic, or serif style",
  },

  // Search
  searchBar: {
    label: "Search",
    hint: "Search books and reading moments",
  },
  clearSearch: {
    label: "Clear search",
    hint: "Removes the current search query",
  },

  // Profile
  profileSettings: {
    label: "Settings",
    hint: "Opens app settings and preferences",
  },
  logout: {
    label: "Log out",
    hint: "Signs you out of the app",
  },
  language: {
    label: "Language",
    hint: "Choose your preferred language",
  },
  notifications: {
    label: "Notifications",
    hint: "Manage notification preferences",
  },

  // Premium
  upgradePremium: {
    label: "Upgrade to Premium",
    hint: "Subscribe to unlock AI features",
  },
  subscribe: {
    label: "Subscribe",
    hint: "Completes your subscription to Premium",
  },

  // Chat
  sendMessage: {
    label: "Send message",
    hint: "Sends your message to the AI assistant",
  },
  messageInput: {
    label: "Message input",
    hint: "Type your question or message here",
  },

  // Menu
  menu: {
    label: "Options menu",
    hint: "Opens additional options for this screen",
  },

  // Export
  exportBook: {
    label: "Export book",
    hint: "Download your reading moments as PDF or Markdown",
  },
  exportFormat: (format: string) => ({
    label: `Export as ${format}`,
    hint: `Downloads your reading moments in ${format} format`,
  }),

  // Notifications
  toggleNotification: (type: string) => ({
    label: `${type} notifications`,
    hint: `Turn ${type} notifications on or off`,
  }),
  notificationTime: {
    label: "Notification time",
    hint: "Choose when you want to receive notifications",
  },
};
