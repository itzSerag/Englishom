import { Injectable } from "@nestjs/common";
import { AbstractRepo } from "src/common/database/repo/abstract.repo";
import { UserModel } from "../models/user.schema";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";


@Injectable()
export class UserRepo extends AbstractRepo<UserModel> {
    constructor(
        @InjectModel(UserModel.name) private readonly userModel: Model<UserModel>,
    ) {
        super(userModel);
    }

    async findByEmail(email: string): Promise<UserModel | null> {
        return await this.userModel.findOne({ email });
    }

    async findById(id: string): Promise<UserModel | null> {
        return await this.userModel.findById(id);
    }
}