# Aliko Business Enterprise — Sales & Inventory Management System

> A desktop-based Point of Sale (POS), Sales, Inventory and Business Management System built with Electron, JavaScript, SQLite and modern web technologies.

![Project Status](https://img.shields.io/badge/status-completed-success)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-Desktop%20App-47848F)
![Node.js](https://img.shields.io/badge/Node.js-Runtime-green)
![SQLite](https://img.shields.io/badge/Database-SQLite-003B57)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 📌 Project Overview

The **Aliko Business Enterprise Sales & Inventory Management System** is a desktop application developed to replace manual, paper-based sales and inventory processes with an integrated digital solution.

The system is designed for a hardware/building-materials business and provides functionality for managing:

* Products
* Inventory
* Customers
* Sales
* Quotations
* Invoices
* Backorders
* Users and permissions
* Stock adjustments
* Reports
* Audit logs
* Receipt and document printing
* Dashboard business intelligence

The application uses a local SQLite database, making it suitable for businesses that require a reliable desktop system without depending on a continuous internet connection.

---

## 🎯 Problem Statement

Small businesses often rely on notebooks, spreadsheets and disconnected processes to manage sales and inventory.

This can result in:

* Inaccurate stock records
* Difficult sales tracking
* Manual calculation errors
* Poor visibility of business performance
* Slow invoice and quotation preparation
* Limited user accountability
* Difficulty identifying low-stock products
* Time-consuming reporting

This system was developed to provide a centralized solution for managing these activities.

---

# 🚀 Key Features

## 🛒 Point of Sale

* Product search
* Shopping cart
* Quantity management
* Real-time totals
* Multiple payment options
* Checkout workflow
* Receipt generation
* Receipt printing
* Stock deduction after completed sales

## 📦 Inventory Management

* Product management
* SKU management
* Stock levels
* Stock adjustments
* Low-stock indicators
* Out-of-stock status
* Inventory transaction tracking
* Stock protection rules
* Automatic stock updates following sales

## 👥 Customer Management

* Add customers
* Edit customer information
* Search customers
* Customer history
* Customer-related sales information

## 🧾 Sales & Documents

* Sales processing
* Invoice generation
* Quotation creation
* Purchase orders
* Backorders
* Document status management
* Invoice numbering
* PDF document generation
* Document printing

## 👨‍💼 User Management

The system implements role-based access control.

Example roles include:

* Administrator
* Manager
* Cashier
* Store Clerk

Permissions are used to control access to sensitive operations.

## 📊 Dashboard

The dashboard provides business-level information including:

* Today's sales
* Low-stock products
* Pending orders
* Sales trends
* Inventory information
* Business performance indicators

## 🔐 Security

Security-related features include:

* Password hashing
* User authentication
* Role-based authorization
* Protected IPC communication
* Destructive-action protection
* Session management
* Input validation
* Audit logging
* Electron window security controls

## 📝 Audit Logging

Important business operations can be recorded through audit logs to improve accountability and traceability.

## 🖨️ Printing

The application supports business document generation and printing, including:

* Sales receipts
* Invoices
* Quotations
* Statements

---

# 🏗️ System Architecture

The application follows a layered architecture designed to separate the user interface, business logic and data access responsibilities.

```text
┌─────────────────────────────────────────┐
│              Renderer UI                │
│                                         │
│ HTML • CSS • JavaScript                 │
│ Components • Views • Templates          │
└───────────────────┬─────────────────────┘
                    │
                    │ Secure IPC
                    ▼
┌─────────────────────────────────────────┐
│             Electron Main               │
│                                         │
│ IPC Handlers                            │
│ Services                                │
│ Business Rules                          │
│ Authentication                          │
│ Security                                │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          Repository / Data Layer        │
│                                         │
│ Customer Repository                     │
│ Product Repository                      │
│ Inventory Repository                    │
│ Sales Repository                        │
│ Invoice Repository                      │
│ User Repository                         │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│               SQLite                    │
│                                         │
│ Products • Inventory • Sales            │
│ Customers • Users • Documents           │
│ Audit Logs • Transactions               │
└─────────────────────────────────────────┘
```

---

# 🛠️ Technology Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Modular JavaScript components
* Responsive UI techniques

### Backend / Desktop Runtime

* Electron
* Node.js

### Database

* SQLite
* Better-SQLite3

### Development

* Git
* GitHub
* Visual Studio Code
* npm

### Testing

* Jest
* Automated tests
* Integration testing
* Security testing
* Data-integrity testing

### Documentation & Development Tools

* UML
* ER diagrams
* System architecture diagrams
* Git/GitHub version control

---

# 📁 Project Structure

```text
sales-inventory-system/
│
├── .github/
│   └── workflows/
│       ├── build.yml
│       ├── release.yml
│       └── test.yml
│
├── assets/
│
├── config/
│   ├── app.config.js
│   ├── database.config.js
│   ├── eslint.config.js
│   └── logging.config.js
│
├── resources/
│
├── scripts/
│   ├── build.bat
│   ├── clean.js
│   ├── run-tests.js
│   └── ...
│
├── src/
│   ├── main/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── documents/
│   │   ├── ipc/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── security/
│   │   ├── services/
│   │   └── windows/
│   │
│   ├── renderer/
│   │   ├── assets/
│   │   ├── js/
│   │   ├── styles/
│   │   └── templates/
│   │
│   └── shared/
│       ├── constants/
│       └── types/
│
├── tests/
│   ├── auth/
│   ├── database/
│   ├── inventory/
│   ├── documents/
│   ├── security/
│   └── ...
│
├── package.json
├── package-lock.json
├── electron-builder.yml
├── forge.config.js
└── README.md
```

---

# 🖥️ Application Screenshots

## Login

![Login Screen](docs/screenshots/login.png)

## Dashboard

![Dashboard](docs/screenshots/dashboard.png)

## Point of Sale

![Point of Sale](docs/screenshots/pos.png)

## Inventory

![Inventory](docs/screenshots/inventory.png)

## Products

![Products](docs/screenshots/products.png)

## Sales

![Sales](docs/screenshots/sales.png)

## Invoices & Quotations

![Invoices and Quotations](docs/screenshots/invoices.png)

> Screenshots will be added to the repository as the project documentation is finalized.

---

# ⚙️ Installation

## Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Git

Clone the repository:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

Navigate into the project:

```bash
cd sales-inventory-system
```

Install dependencies:

```bash
npm install
```

---

# ▶️ Running the Application

Start the development application:

```bash
npm start
```

Depending on the configured scripts, development or testing commands may also be available through:

```bash
npm test
```

```bash
npm run verify
```

```bash
npm run dist
```

---

# 🧪 Testing

The project contains automated tests covering several areas of the application.

Examples include:

* Authentication
* Database integrity
* Inventory operations
* Sales calculations
* Invoice layout
* Security controls
* IPC authorization
* Stock adjustments
* Dashboard functionality
* Document generation

Run the test suite with:

```bash
npm test
```

---

# 📦 Building the Application

The project is configured for Electron application packaging.

A production build can be generated using the project's build scripts.

Example:

```bash
npm run dist
```

The generated installer/build artifacts are intentionally excluded from Git using `.gitignore`.

---

# 🔐 Data & Security Considerations

The application is designed with security and data integrity in mind.

Key considerations include:

* Password hashing rather than storing plaintext passwords
* Role-based permissions
* Restricted IPC communication
* Database constraints
* Input validation
* Transaction-based database operations
* Audit logging
* Protection against unauthorized destructive actions

---

# 💡 Technical Challenges

During development, several real-world software engineering challenges were addressed, including:

### Electron ↔ Node.js communication

Secure communication between the renderer process and Electron's main process was implemented using IPC handlers and a preload layer.

### Database integrity

The application uses SQLite with migrations and transaction handling to maintain consistent business data.

### Inventory consistency

Sales operations automatically update stock quantities while protecting against invalid inventory states.

### Document generation

Invoices, quotations and receipts require consistent business data, formatting and printing layouts.

### Native dependencies

Electron applications using native Node modules require careful dependency and runtime management during development and packaging.

---

# 📈 Future Improvements

Potential future improvements include:

* Cloud synchronization
* Multi-branch support
* Online backup
* Mobile application integration
* Advanced analytics
* Customer credit management
* Supplier management
* Barcode scanner integration
* Automated cloud reporting
* Remote administration
* Multi-user network deployment

---

# 👨‍💻 Developer

**Yamikani Kaferawanthu**

BSc Management Information Systems
Level 5 Diploma in Computing & Information Systems

Areas of interest:

* Software Development
* Business Intelligence
* Data Analytics
* Information Systems
* Database Systems
* Desktop Application Development
* Business Process Automation

---

# 📄 License

This project is intended primarily as a portfolio and demonstration project.

See the repository license for usage and distribution terms.

---

## ⭐ Project

If you find this project useful or interesting, consider giving the repository a ⭐.
