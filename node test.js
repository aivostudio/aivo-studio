import { testR2, putTestObject } from "./r2.js";

const buckets = await testR2();
console.log("Buckets:", buckets);

const key = await putTestObject();
console.log("Uploaded:", key);
