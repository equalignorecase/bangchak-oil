# ราคาน้ำมันบางจาก 🛢️

หน้าเว็บ HTML / CSS / JavaScript แบบ static ที่ดึงราคาน้ำมันจาก
`https://oil-price.bangchak.co.th/ApiOilPrice2/th` แล้วแสดงเป็นตารางเรียบ ๆ
พร้อมค้นหา กรองตามหมวด และอัปเดตอัตโนมัติทุก 5 นาที

## เริ่มใช้งาน

```bash
node server.js
# เปิด http://localhost:3000
```

หรือใช้ `npm start` ก็ได้ (ต้องมี Node.js 18 ขึ้นไป เพราะใช้ `fetch`)

บน macOS สามารถ **ดับเบิลคลิก `start.command`** เพื่อเปิดเซิร์ฟเวอร์และเบราว์เซอร์ให้อัตโนมัติ

> เจอ error `HTTP 401`, `HTTP 404` หรือ `HTTP 502` แปลว่าหน้ายังไม่ได้รันผ่าน `server.js`
> (เช่น เปิดด้วย Live Server หรือเปิดไฟล์ตรง ๆ) ให้หยุด server ตัวนั้นแล้วรัน `node server.js` แทน

## Deploy บน Vercel

โปรเจกต์มี `api/oil.js` เป็น Serverless Function สำหรับ proxy `/api/oil` แล้ว
(`server.js` ยังใช้รันในเครื่องได้ตามเดิม)

1. push โค้ดขึ้น GitHub
2. ที่ Vercel เลือก **Add New Project** → import repo
3. Framework Preset: **Other** — ไม่ต้องใส่ Build Command หรือ Output Directory
4. Deploy

หรือใช้ CLI:

```bash
npm i -g vercel
vercel --prod
```

หมายเหตุ: Vercel จะไม่รัน `server.js` (เป็น long-running server) จึงต้องมี `api/oil.js`

## Tech Stack

| ส่วน | ใช้อะไร |
|---|---|
| หน้าเว็บ | HTML, CSS, JavaScript (vanilla) — ไม่มี framework |
| เซิร์ฟเวอร์ | Node.js ≥18 (`http`, `fs`) — zero dependency, static server + proxy `/api/oil` แคช 60 วินาที (รันในเครื่อง) |
| Deploy | Vercel Serverless Function `api/oil.js` — proxy `/api/oil` พร้อม cache `s-maxage=60` |
| แหล่งข้อมูล | [Bangchak Oil Price API](https://oil-price.bangchak.co.th/ApiOilPrice2/th) |
| ฟอนต์ | IBM Plex Sans Thai (Google Fonts) |
| เก็บค่าฝั่งผู้ใช้ | `localStorage` (ธีม + ข้อมูลล่าสุด) |
| Build | ไม่มี — เปิดไฟล์ static ได้ทันที |

## ฟีเจอร์

- โลโก้สินค้าน้ำมันแต่ละรายการจาก API (`IconWeb`) ถ้าโหลดไม่ได้จะ fallback เป็นจุดสีตามหมวด
- จุดสีในแท็บกรองบอกหมวด: ดีเซล (เขียว) / แก๊สโซฮอล์ (ส้ม) / พรีเมียม (ม่วง)
- ตารางราคา: เมื่อวาน / วันนี้ / พรุ่งนี้ / ส่วนต่าง พร้อมสีบอกขึ้น–ลง
- ค้นหาชนิดน้ำมัน และกรองหมวด: ดีเซล / แก๊สโซฮอล์ / พรีเมียม
- รีเฟรชเองได้ และอัปเดตอัตโนมัติทุก 5 นาที
- โหมดสว่าง/มืด: กดปุ่ม "โหมดมืด" ในหัวเว็บ จำค่าไว้ใน `localStorage` และตามค่าระบบในครั้งแรก
- แคชข้อมูลล่าสุดไว้แสดงเมื่อเน็ตหลุด
- เอฟเฟค: แถวค่อย ๆ ปรากฏตอนโหลด/สลับแท็บ, ไฮไลต์ราคาที่เปลี่ยนพร้อมนับเลขขึ้น–ลง, spinner ตอนรีเฟรช, ธีมเปลี่ยนแบบ fade, หัวเรื่องมีแสงวิ่งผ่านตัวอักษร (shine) — ปิดอัตโนมัติเมื่อผู้ใช้ตั้ง `prefers-reduced-motion`
- Responsive: จอ ≤600px เปลี่ยนตารางเป็นสองบรรทัด (ชื่อ + ราคาวันนี้/ส่วนต่าง, ด้านล่างเป็นเมื่อวาน–พรุ่งนี้) และหัวเว็บจัดใหม่ที่ ≤560px

## โครงสร้างไฟล์

```
oil-api/
├── index.html   # โครงหน้าเว็บ
├── styles.css   # ธีม สี responsive และ animation
├── app.js       # fetch + แปลงข้อมูล + render + interaction
├── logo.svg     # โลโก้/ไอคอนแท็บ (fuel pump)
├── server.js    # static server + proxy /api/oil (zero dependency)
├── api/
│   └── oil.js   # Vercel Serverless Function สำหรับ /api/oil
├── start.command # เปิดเซิร์ฟเวอร์ + เบราว์เซอร์บน macOS
├── package.json # npm start → node server.js
└── .gitignore
```

## หมายเหตุ

- ราคาเป็นบาทต่อลิตร ราคาขายปลีกเขตกรุงเทพฯ และยังไม่รวมภาษีบำรุงท้องถิ่น
- `PriceDifYesterday` ใน API อาจเป็น 0 เสมอ หน้าเว็บจึงคำนวณส่วนต่างเองจาก
  `PriceToday - PriceYesterday`
- โปรเจกต์นี้เป็นตัวอย่างเพื่อการเรียนรู้ ไม่ได้มีความเกี่ยวข้องกับบริษัทบางจากฯ
