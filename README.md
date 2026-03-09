# Sieu thi dong gia (MVP)

Monorepo gom `backend/` (Express + Prisma + SQLite) va `frontend/` (React + Vite + Tailwind).

## 1) Tech stack

- Frontend: React + Vite + TypeScript + Tailwind
- Backend: Node.js + Express + TypeScript
- DB: SQLite + Prisma ORM
- Auth: Email/password (bcrypt) + JWT + role-based
- In hoa don: trang `/receipt/:id` voi print CSS (A5)

## 2) Cau truc thu muc

```txt
.
|- backend/
|  |- prisma/
|  |  |- schema.prisma
|  |  |- seed.ts
|  |  |- migrations/
|  |- src/
|  |  |- routes -> controllers -> services -> db
|  |  |- middleware/
|  |  |- utils/
|  |- tests/services/
|  |- api.http
|- frontend/
|  |- src/
|  |  |- pages (login, pos, products, warehouses, purchases, reports, settings, receipt)
|  |  |- context/
|  |  |- api/
|  |  |- components/
```

## 3) Backend setup

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:init
npm run dev
```

Backend mac dinh: `http://localhost:4000`

Neu ban muon workflow migrate interactive:

```bash
npm run prisma:migrate
```

## 4) Tai khoan seed

- `admin@donggia.local` / `123456`
- `manager@donggia.local` / `123456`
- `cashier@donggia.local` / `123456`
- `warehouse@donggia.local` / `123456`

## 5) Seed data da tao

- 30 san pham
- 3 muc dong gia (10k/15k/20k)
- 2 kho
- 5 khach hang
- 3 nha cung cap
- 10 phieu nhap

## 6) Frontend setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend mac dinh: `http://localhost:5173`

## 7) API test nhanh

- File test API: `backend/api.http`
- Import vao VS Code REST Client hoac tuong duong.

## 8) Nghiep vu chinh da co

- Quan ly price tiers + CRUD product + log doi tier (`ProductPriceTierHistory`)
- POS ban hang: cart, discount %, discount amount, cash/bank/mixed, complete sale, void invoice
- Kho: ledger append-only, stock adjust (+/-), chuyen kho giua 2 kho
- Mua hang: tao phieu nhap (GRN), cap nhat gia von moving average
- Bao cao: doanh thu day/week/month, top product, profit estimate, canh bao ton thap

## 9) Kiem thu

```bash
cd backend
npm test
```

Co 3 service test toi thieu:

- `createSale`
- `createPurchaseReceipt`
- `transferStock`

## 10) Format ma chung tu

- Hoa don ban: `INV-YYYYMMDD-0001`
- Phieu nhap: `GRN-YYYYMMDD-0001`
- Lenh chuyen kho: `TRF-YYYYMMDD-0001`

## 11) Ghi chu

- TypeScript `strict` cho backend/frontend.
- Tat ca config doc tu env, khong hardcode URL/secret trong code runtime.
- Neu can in A6, chinh trong `frontend/src/styles/index.css` (`@page size`).
- Version hien thi tren UI lay tu `VITE_APP_VERSION` (neu khong set se dung version trong `frontend/package.json`).
- `GET /health` tra ve `version` cua backend (co the override bang env `APP_VERSION`).

