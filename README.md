# Teyvat Kitchen

ระบบสั่งอาหารธีม Genshin พัฒนาด้วย React, Vite และ Express โดยอ้างอิงหน้าจอใน `Genshin Kitchen.pdf` และ flow/API ใน `DSA Project Guide.pdf`

## เริ่มใช้งาน

ติดตั้ง dependencies ครั้งแรกจากโฟลเดอร์โปรเจกต์:

```bash
npm install
```

เปิด Terminal 2 หน้าต่างใน VS Code โดยให้ทั้งคู่อยู่ที่โฟลเดอร์โปรเจกต์:

1. Terminal แรก: `npm run server` — เริ่ม Express API ที่ `http://localhost:3000` และปล่อยให้ทำงานค้างไว้
2. Terminal ที่สอง: `npm run dev` — เริ่ม React/Vite; เปิด URL ที่แสดงใน Terminal (ปกติคือ `http://localhost:5173`)

Vite proxy `/api` และ `/images` ไปยัง Express อัตโนมัติ จึงต้องเปิด server ควบคู่กันระหว่างพัฒนา

สำหรับรัน production build ในเครื่อง ให้ใช้ `npm run build` แล้ว `npm run server`; จากนั้นเปิด `http://localhost:3000`. `vercel.json` ตั้งค่า static build และ Express API แยก route ไว้แล้ว

หากพอร์ต 3000 หรือ 5173 ถูกใช้งานอยู่ ให้ปิดโปรแกรมเดิมที่ใช้พอร์ตนั้นก่อนเริ่มใหม่

```bash
npm test
npm run lint
```

## ข้อมูลและรูปภาพ

- Express ใช้ `menu.json` ที่แนบมากับโปรเจกต์เป็นแหล่งข้อมูลรายการอาหาร ราคา วัตถุดิบ และร้าน; ข้อมูลเหล่านี้ยังไม่ได้ตรวจยืนยันกับแหล่งทางการ
- รูปอาหารใน `genshin-food/` ให้บริการผ่าน `/images/` และนำไปแสดงทั้งหน้า MENU, หน้าร้าน และรายละเอียดอาหาร
- ยังไม่มีภาพหน้าร้านแยกในชุดไฟล์; การ์ดร้านใช้ภาพอาหารจานแรกของร้านเป็นภาพประกอบแทน
- `menu.json` ไม่มีข้อมูล Effect จึงไม่เติมค่าคาดเดา; ตัวกรอง Effect จะปิดไว้จนกว่าจะมีข้อมูลจริง
- รายการ Landmark ยังอยู่ใน `src/data.js` เพราะไม่มีใน `menu.json`; ควรยืนยันกับแหล่งข้อมูลเกมก่อนใช้เป็นข้อมูลจริง

## API หลัก

| Method | Endpoint | หน้าที่ |
| --- | --- | --- |
| GET | `/api/restaurants` | ร้านสำหรับหน้าแรก |
| GET | `/api/menu` | เมนูรวมสำหรับหน้า MENU |
| GET | `/api/restaurants/:id/menu` | เมนูร้านและเมนูประจำวัน |
| POST | `/api/login` | ตรวจ UID, Nation และ Landmark |
| POST | `/api/orders` | ตรวจรายการและคำนวณยอดจากเมนูฝั่ง server |
| GET | `/api/orders?uid=...` | สถานะออเดอร์ที่ server คำนวณ |
| PATCH | `/api/orders/:id/cancel` | ยกเลิก Pending/Accepted; คืน `409` เมื่อยกเลิกไม่ได้ |

สถานะ Pending (20s), Accepted (10s), Preparing (25s), Leading (ตาม ETA) คำนวณที่ Express; OrderTrack polling สถานะจาก server ส่วนคิวเสิร์ฟและ Undo เดิมยังคงมี endpoint `/orders`, `/history` และ `/undo` แต่ไม่อยู่ใน flow UI ตาม Guide ออเดอร์ปัจจุบันเก็บใน memory ของ Express process และจะไม่คงอยู่หลัง server restart

## DSA

| โครงสร้าง | ใช้ที่ |
| --- | --- |
| Insertion Sort | ตัวกรองร้านและเมนู |
| Hash Table | ค้นหาร้าน/เมนูบนหน้าแรก |
| Priority Queue (Min-Heap) | หาออเดอร์ที่จะถึงก่อนใน OrderTrack |
| Stack | Previous Page |
| Graph (`FLOW`) | ควบคุมเส้นทาง HOME, MENU, ร้าน, Checkout และ OrderTrack |
