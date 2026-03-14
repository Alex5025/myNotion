# myNotion - Hierarchical Block-based Editor

`myNotion` is a powerful, Notion-inspired markdown editor built with **Vue 3** and **Spring Boot**. It features a hierarchical block-based editing experience with support for drag-and-drop, nesting, and real-time markdown rendering.

![Dashboard Preview](https://via.placeholder.com/800x400.png?text=myNotion+Preview) *(Placeholder for actual screenshot)*

## ✨ Features

- 🏗️ **Hierarchical Blocks**: Create nested content structures with simple `Tab` and `Shift+Tab` indentations.
- 🖱️ **Drag & Drop**: Reorder entire blocks (including their nested children) using a handle.
- 📝 **Markdown Support**: Rich text rendering with support for tables, task lists, and code highlighing.
- 💻 **Syntax Highlighting**: Beautiful code blocks powered by `highlight.js`.
- 🚀 **RESTful Backend**: Spring Boot backend with H2 database for document persistence.
- 🎨 **Modern UI**: Clean, responsive interface built with Vue 3 and Vanilla CSS.

## 📝 Markdown Examples

### Tables
| Name | Role | Status |
| :--- | :--- | :---: |
| Antigravity | AI Architect | 🚀 |
| User | Lead Creator | ✨ |
| myNotion | Core Engine | 🛠️ |

### Task Lists
- [x] Hierarchical blocks
- [x] Drag and drop
- [ ] Real-time collaboration

## 🛠️ Tech Stack

### Frontend
- **Vue 3** (Composition API)
- **Vite** (Build Tool)
- **Pinia** (State Management)
- **vuedraggable** (Sorting & Nesting)
- **marked** & **dompurify** (Markdown processing)

### Backend
- **Spring Boot 3**
- **Java 21**
- **Spring Data JPA**
- **H2 Database**

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- JDK 21
- Maven

### Installation & Run

#### 1. Backend
```bash
cd backend
./mvnw spring-boot:run
```
Running on: `http://localhost:8081`

#### 2. Frontend
```bash
cd frontend-vue
npm install
npm run dev
```
Running on: `http://localhost:5173`

## 📂 Project Structure

- `/backend`: Spring Boot application source code.
- `/frontend-vue`: Vue.js frontend application.
- `HANDOVER.md`: Detailed technical handover documentation.

## 📄 License
This project is licensed under the MIT License.

---
Developed as a demonstration of a hierarchical block-based architecture.
