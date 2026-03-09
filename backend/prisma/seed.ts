import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { AUDIT_ACTIONS, ROLES, STOCK_REF_TYPES } from "../src/constants/domain";

const prisma = new PrismaClient();

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

const makeCode = (prefix: string, date: Date, seq: number) => {
  return `${prefix}-${formatDate(date)}-${String(seq).padStart(4, "0")}`;
};

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.stockTransferLine.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.salesLine.deleteMany();
  await prisma.salesInvoice.deleteMany();
  await prisma.purchaseLine.deleteMany();
  await prisma.purchaseReceipt.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.productPriceTierHistory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.priceTier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("123456", 10);

  const [admin, manager, cashier, warehouseUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@donggia.local",
        fullName: "Quản trị hệ thống",
        role: ROLES.ADMIN,
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: "manager@donggia.local",
        fullName: "Quản lý cửa hàng",
        role: ROLES.MANAGER,
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: "cashier@donggia.local",
        fullName: "Thu ngân 1",
        role: ROLES.CASHIER,
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: "warehouse@donggia.local",
        fullName: "Nhân viên kho 1",
        role: ROLES.WAREHOUSE,
        passwordHash,
      },
    }),
  ]);

  const tiers = await prisma.$transaction([
    prisma.priceTier.create({ data: { name: "Đồng giá 10K", price: 10000 } }),
    prisma.priceTier.create({ data: { name: "Đồng giá 15K", price: 15000 } }),
    prisma.priceTier.create({ data: { name: "Đồng giá 20K", price: 20000 } }),
  ]);

  const [wh1, wh2] = await prisma.$transaction([
    prisma.warehouse.create({ data: { name: "Kho trung tâm", location: "Quận 1" } }),
    prisma.warehouse.create({ data: { name: "Kho chi nhánh", location: "Quận 7" } }),
  ]);

  await prisma.customer.createMany({
    data: [
      { name: "Khách lẻ", phone: "0000000000" },
      { name: "Lê Minh", phone: "0901111111" },
      { name: "Trần Hòa", phone: "0902222222" },
      { name: "Nguyễn Vy", phone: "0903333333" },
      { name: "Phạm Khánh", phone: "0904444444" },
    ],
  });

  await prisma.supplier.createMany({
    data: [
      { name: "NCC Minh Phát", phone: "0281111111" },
      { name: "NCC Giá Rẻ", phone: "0282222222" },
      { name: "NCC Tạp Hóa", phone: "0283333333" },
    ],
  });

  const baseProducts = [
    "Bàn chải",
    "Kem đánh răng",
    "Nước rửa chén",
    "Giấy ăn",
    "Khăn giấy",
    "Bột giặt",
    "Nước xả",
    "Túi rác",
    "Khẩu trang",
    "Nước suối",
    "Mì gói",
    "Bánh quy",
    "Sữa hộp",
    "Dầu gội",
    "Sữa tắm",
    "Xà phòng",
    "Nước lau sàn",
    "Cotton bud",
    "Bông tẩy trang",
    "Kẹp tóc",
    "Muỗng nhựa",
    "Hộp đựng đồ ăn",
    "Màng bọc thực phẩm",
    "Giấy bạc",
    "Nắp chai",
    "Trà túi lọc",
    "Cà phê gói",
    "Bánh tráng",
    "Ruốc bông",
    "Bánh snack",
  ];

  const products = await Promise.all(
    baseProducts.map((name, idx) => {
      const tier = tiers[idx % tiers.length];
      const sku = `SP${String(idx + 1).padStart(3, "0")}`;
      const barcode = `8936000${String(idx + 1).padStart(6, "0")}`;
      return prisma.product.create({
        data: {
          sku,
          barcode,
          name,
          unit: "pcs",
          priceTierId: tier.id,
          cost: Math.round(tier.price * 0.6),
          minStock: 10 + (idx % 5) * 5,
          active: true,
        },
      });
    })
  );

  // Add custom-priced products (giá riêng)
  const customPriceProducts = [
    { name: "Gạo ST25 5kg", customPrice: 135000, cost: 95000, unit: "bao" },
    { name: "Dầu ăn Simply 1L", customPrice: 45000, cost: 32000, unit: "chai" },
    { name: "Nước mắm Nam Ngư 500ml", customPrice: 28000, cost: 19000, unit: "chai" },
    { name: "Đường Biên Hòa 1kg", customPrice: 25000, cost: 18000, unit: "gói" },
    { name: "Nước tương Maggi 300ml", customPrice: 18000, cost: 12000, unit: "chai" },
  ];

  const customProducts = await Promise.all(
    customPriceProducts.map((p, idx) => {
      const seqNum = baseProducts.length + idx + 1;
      const sku = `SP${String(seqNum).padStart(3, "0")}`;
      const barcode = `8936000${String(seqNum).padStart(6, "0")}`;
      return prisma.product.create({
        data: {
          sku,
          barcode,
          name: p.name,
          unit: p.unit,
          customPrice: p.customPrice,
          cost: p.cost,
          minStock: 5,
          active: true,
        },
      });
    })
  );

  const allProducts = [...products, ...customProducts];

  const suppliers = await prisma.supplier.findMany();
  const today = new Date();

  for (let i = 0; i < 10; i += 1) {
    const supplier = suppliers[i % suppliers.length];
    const warehouse = i % 2 === 0 ? wh1 : wh2;
    const lineProducts = allProducts.slice(i * 3, i * 3 + 3);
    const code = makeCode("GRN", today, i + 1);

    await prisma.$transaction(async (tx) => {
      const lines = lineProducts.map((product, lineIdx) => {
        const qty = 20 + lineIdx * 5;
        const unitCost = Math.max(1000, Math.round(product.cost + lineIdx * 300));
        return {
          productId: product.id,
          qty,
          unitCost,
          lineCost: qty * unitCost,
        };
      });

      const totalCost = lines.reduce((sum, line) => sum + line.lineCost, 0);

      const receipt = await tx.purchaseReceipt.create({
        data: {
          code,
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          totalCost,
          createdById: manager.id,
        },
      });

      await tx.purchaseLine.createMany({
        data: lines.map((line) => ({
          receiptId: receipt.id,
          productId: line.productId,
          qty: line.qty,
          unitCost: line.unitCost,
          lineCost: line.lineCost,
        })),
      });

      for (const line of lines) {
        await tx.stockLedger.create({
          data: {
            productId: line.productId,
            warehouseId: warehouse.id,
            qtyChange: line.qty,
            unitCost: line.unitCost,
            refType: STOCK_REF_TYPES.PURCHASE_RECEIPT,
            refId: String(receipt.id),
          },
        });

        await tx.product.update({
          where: { id: line.productId },
          data: { cost: line.unitCost },
        });
      }
    });
  }

  await prisma.auditLog.createMany({
    data: [
      {
        entity: "seed",
        entityId: "users",
        action: AUDIT_ACTIONS.CREATE,
        afterJson: JSON.stringify({ users: [admin.email, manager.email, cashier.email, warehouseUser.email] }),
        createdById: admin.id,
      },
      {
        entity: "seed",
        entityId: "products",
        action: AUDIT_ACTIONS.CREATE,
        afterJson: JSON.stringify({ count: allProducts.length }),
        createdById: admin.id,
      },
    ],
  });

  console.log("Seed completed", {
    users: 4,
    products: allProducts.length,
    warehouses: 2,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

