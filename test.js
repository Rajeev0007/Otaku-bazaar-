// Runs the checks twice: once with local file storage, once with Redis storage (as used on Vercel).
const {spawnSync}=require("child_process");
let bad=0;
for(const mode of ["file","redis"]){
  console.log("\n=== storage: "+mode+" ===");
  const r=spawnSync(process.execPath,["--test","suite.js"],{stdio:"inherit",cwd:__dirname,env:{...process.env,TEST_MODE:mode}});
  if(r.status!==0)bad++;
}
console.log(bad?"\nSOME TESTS FAILED":"\nAll tests passed");process.exit(bad?1:0);
