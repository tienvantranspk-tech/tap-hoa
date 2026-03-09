import { NextFunction, Request, Response } from "express";
import {
    adjustDebt,
    getDebtHistory,
    getDebtReminders,
    listCustomersWithDebt,
    recordDebtPayment,
    updateCustomerDebtLimit,
} from "../../services/debts/debt.service";
import { requireUser } from "../../middleware/validate";

export const getCustomersDebt = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await listCustomersWithDebt());
    } catch (error) {
        next(error);
    }
};

export const getCustomerDebtHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = Number(req.params.customerId);
        const page = req.query.page ? Number(req.query.page) : 1;
        const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
        res.json(await getDebtHistory(customerId, { page, pageSize }));
    } catch (error) {
        next(error);
    }
};

export const postDebtPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = requireUser(req);
        const customerId = Number(req.params.customerId);
        const { amount, note } = req.body;
        const result = await recordDebtPayment({
            customerId,
            amount: Number(amount),
            note,
            createdById: user.id,
        });
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
};

export const postDebtAdjust = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = requireUser(req);
        const customerId = Number(req.params.customerId);
        const { amount, type, note } = req.body;
        const result = await adjustDebt({
            customerId,
            amount: Number(amount),
            type,
            note,
            createdById: user.id,
        });
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
};

export const putDebtLimit = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = Number(req.params.customerId);
        const { debtLimit } = req.body;
        const result = await updateCustomerDebtLimit(customerId, Number(debtLimit));
        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const getReminders = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await getDebtReminders());
    } catch (error) {
        next(error);
    }
};
