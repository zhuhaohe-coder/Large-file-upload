<template>
  <div class="App">
    <IViewUpload
      type="drag"
      action="''"
      :before-upload="handleBeforeUpload">
      <div style="padding: 20px 0">
        <IViewIcon
          type="ios-cloud-upload"
          size="52"
          style="color: #3399ff">
        </IViewIcon>
        <p>Click or drag files here to upload</p>
        <IViewSpin
          fix
          v-if="uploadVideoLoading">
          <IViewIcon
            type="ios-loading"
            size="18"
            class="demo-spin-icon-load"></IViewIcon>
          <div>Loading</div>
        </IViewSpin>
      </div>
    </IViewUpload>
  </div>
</template>

<script>
import axios from "axios";
// 切片大小：10M；
const CHUNK_SIZE = 10 * 1024 * 1024;
// 上传接口
const UPLOAD_URL = "http://localhost:3000/upload";
// 合并接口
const MERGE_URL = "http://localhost:3000/merge";
// 验证是否已上传接口
const VERIFY_URL = "http://localhost:3000/verify";

export default {
  data() {
    return {
      uploadVideoLoading: false,
      hashWorker: null,
      hashPercentage: 0,
      fileHash: "",
    };
  },
  created() {
    this.controller = new AbortController();
  },
  methods: {
    async handleBeforeUpload(file) {
      this.uploadVideoLoading = true;
      // 文件切片
      const fileChunkList = this.chunkFile(file);
      // 生成文件hash
      this.fileHash = await this.calculateHash(fileChunkList);
      // 合并后的文件名为 fileHash + 文件后缀
      const suffix = file.name.split(".").pop();

      // 验证，文件秒传和断点续传的关键点
      const {
        data: { shouldUpload, alreadyUpload, complete },
      } = await this.checkFileExist(this.fileHash, suffix);
      // 已经上传过了，直接返回
      if (!shouldUpload) {
        alert("文件秒传-上传成功");
        return;
      }
      // 添加hash值
      let chunkListWithHash = this.setChunkListWithHash(
        fileChunkList,
        file.name
      );
      // 需要上传的切片
      if (!complete) {
        chunkListWithHash = chunkListWithHash.filter(
          ({ hash }) => !alreadyUpload.includes(hash.slice(-1))
        )
      }
      // 上传切片
      const res = await this.uploadChunks(chunkListWithHash, file.name);
      const successList = res.filter(promise=>promise.status==='fulfilled');
      // 上传成功
      if (successList.length === chunkListWithHash.length) {
        // 合并切片
        const res = await this.mergeChunks(`${this.fileHash}.${suffix}`);
        console.log(res);
      }

      this.uploadVideoLoading = false;
      // 停止默认上传行为
      return false;
    },
    // 文件切片
    chunkFile(file) {
      console.log(file);
      const fileChunkList = [];
      let cur = 0;
      while (cur < file.size) {
        fileChunkList.push({
          file: file.slice(cur, cur + CHUNK_SIZE),
        });
        cur += CHUNK_SIZE;
      }
      return fileChunkList;
    },
    setChunkListWithHash(fileChunkList, fileName) {
      return fileChunkList.map(({ file }, index) => {
        return {
          chunk: file,
          fileHash: this.fileHash,
          hash: fileName + "-" + index,
        };
      });
    },
    // 上传切片
    async uploadChunks(chunkListWithHash, fileName) {
      const requestList = chunkListWithHash
        .map(({ chunk, hash, fileHash }) => {
          const formData = new FormData();
          formData.append("chunk", chunk);
          formData.append("hash", hash);
          formData.append("filename", fileName);
          formData.append("fileHash", fileHash);
          return { formData };
        })
        .map(({ formData }) => {
          return axios.post(UPLOAD_URL, formData);
        });
      return Promise.allSettled(requestList);
    },
    // 合并切片
    async mergeChunks(fileName) {
      const res = await axios.get(`${MERGE_URL}?name=${fileName}`);
      return res;
    },
    // 生成文件hash
    calculateHash(fileChunkList) {
      return new Promise((resolve) => {
        const startTime = Date.now();
        this.hashWorker = new Worker("/utils/hash.js");
        this.hashWorker.postMessage({
          fileChunkList,
        });
        this.hashWorker.onmessage = ({ data }) => {
          const { percentage, hash } = data;
          this.hashPercentage = percentage;
          if (hash) {
            const endTime = Date.now();
            console.log(`总共用时${(endTime - startTime) / 1000}秒`);
            resolve(hash);
          }
        };
      });
    },
    // 文件秒传,断点续传
    async checkFileExist(fileHash, suffix) {
      const res = await axios.get(
        `${VERIFY_URL}?fileHash=${fileHash}&suffix=${suffix}`
      );
      return res;
    },
  },
};
</script>

<style>
.App {
  width: 300px;
  height: 200px;
}
.demo-spin-icon-load {
  animation: ani-demo-spin 1s linear infinite;
}
@keyframes ani-demo-spin {
  from {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(180deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
