import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'node:fs';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('chunk', 20, {
      dest: 'uploads',
    }),
  )
  uploadFiles(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: { hash: string; fileHash: string },
  ) {
    // 文件夹名
    const chunkDir = `uploads/chunkDir_${body.fileHash}`;
    // 切片名
    const fileName = body.fileHash + '_' + body.hash;

    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir);
    }
    fs.cpSync(files[0].path, `${chunkDir}/${fileName}`);
    fs.rmSync(files[0].path);
  }

  @Get('merge')
  merge(@Query('name') name: string) {
    const chunkDir = `uploads/chunkDir_${name.split('.')[0]}`;
    console.log(chunkDir);
    const files = fs.readdirSync(chunkDir);
    let start = 0;
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const promises = files.map((file) => {
      return new Promise<void>((resolve) => {
        const filePath = chunkDir + '/' + file;
        const stream = fs.createReadStream(filePath);
        stream
          .pipe(fs.createWriteStream('uploads/' + name, { start }))
          .on('finish', () => {
            start += fs.statSync(filePath).size;
            resolve();
          });
      });
    });

    Promise.all(promises).then(() => {
      fs.rm(chunkDir, { recursive: true }, () => {});
    });
  }

  @Get('verify')
  verify(@Query('fileHash') fileHash: string, @Query('suffix') suffix: string) {
    // 已上传完毕，文件秒传
    if (fs.existsSync(`uploads/${fileHash}.${suffix}`)) {
      return {
        complete: true,
        alreadyUpload: 'all',
        shouldUpload: false,
      };
    }

    // 存在切片，断点续传
    if (fs.existsSync(`uploads/chunkDir_${fileHash}`)) {
      const filesNameList = fs.readdirSync(`uploads/chunkDir_${fileHash}`);
      return {
        complete: false,
        alreadyUpload: filesNameList.map((item) => item.slice(-1)),
        shouldUpload: true,
      };
    }

    // 未上传过，正常执行
    return {
      complete: false,
      alreadyUpload: [],
      shouldUpload: true,
    };
  }
}
