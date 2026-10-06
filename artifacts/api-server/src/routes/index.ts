import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import healthRouter from "./health";
import publicRouter from "./public";
import youthRouter from "./youth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(youthRouter);
router.use(adminRouter);

export default router;
