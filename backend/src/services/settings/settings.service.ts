import { prisma } from "../../db/prisma";
import { Role } from "../../constants/domain";
import { AppError } from "../../utils/appError";
import { hashPassword } from "../../utils/password";

export const listPriceTiers = () =>
  prisma.priceTier.findMany({
    orderBy: { price: "asc" },
  });

export const createPriceTier = async (input: { name: string; price: number }) => {
  return prisma.priceTier.create({ data: input });
};

export const updatePriceTier = async (id: number, input: { name?: string; price?: number }) => {
  return prisma.priceTier.update({
    where: { id },
    data: input,
  });
};

export const deletePriceTier = async (id: number) => {
  const products = await prisma.product.count({ where: { priceTierId: id } });
  if (products > 0) {
    throw new AppError("Cannot delete price tier in use", 400);
  }
  return prisma.priceTier.delete({ where: { id } });
};

export const listUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });
};

export const createUser = async (input: {
  email: string;
  password: string;
  role: Role;
  fullName?: string;
}) => {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email,
      role: input.role,
      fullName: input.fullName,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      createdAt: true,
    },
  });
};

export const listCustomers = async () =>
  prisma.customer.findMany({
    orderBy: { id: "asc" },
  });

export const createCustomer = async (input: { name: string; phone?: string; address?: string }) =>
  prisma.customer.create({
    data: input,
  });

export const updateCustomer = async (id: number, input: { name?: string; phone?: string; address?: string }) =>
  prisma.customer.update({
    where: { id },
    data: input,
  });

export const listSuppliers = async () =>
  prisma.supplier.findMany({
    orderBy: { id: "asc" },
  });

export const createSupplier = async (input: { name: string; phone?: string; address?: string }) =>
  prisma.supplier.create({
    data: input,
  });

export const updateSupplier = async (id: number, input: { name?: string; phone?: string; address?: string }) =>
  prisma.supplier.update({
    where: { id },
    data: input,
  });
