import { Request, Response, NextFunction } from "express";
import * as superAdminService from "./service";

export async function listLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      eventType,
      username,
      userEmail,
      search,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    const result = await superAdminService.getLogs({
      eventType: eventType ? String(eventType) : undefined,
      username: username ? String(username) : undefined,
      userEmail: userEmail ? String(userEmail) : undefined,
      search: search ? String(search) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
      offset: offset ? parseInt(String(offset), 10) : undefined,
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
