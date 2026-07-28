/* AIVO AI Reklam Filmi — Seedance upload URL bridge
   The smart editor stores media in private R2. Fal must receive a temporary
   signed GET URL, not the public media.aivo.tr URL when that object is private. */
(function AIVO_AD_FILM_SEEDANCE_UPLOAD_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_SEEDANCE_UPLOAD_FIX__)return;
  window.__AIVO_AD_FILM_SEEDANCE_UPLOAD_FIX__=true;

  function install(){
    var api=window.AIVOAdFilmProjects;
    if(!api||api.__seedanceSignedReadPatched||typeof api.uploadFile!=="function")return false;
    api.__seedanceSignedReadPatched=true;

    api.uploadFile=async function(projectId,file,kind){
      var response=await fetch("/api/ad-film/upload-url",{
        method:"POST",
        credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          projectId:projectId,
          filename:file.name,
          contentType:file.type,
          size:file.size,
          kind:kind
        })
      });
      var signed=await response.json().catch(function(){return{}});
      if(!response.ok){
        var presignError=new Error(signed.message||signed.error||"upload_url_failed");
        presignError.status=response.status;
        presignError.data=signed;
        throw presignError;
      }

      var upload;
      try{
        upload=await fetch(signed.upload_url,{
          method:"PUT",
          headers:signed.required_headers||{"Content-Type":file.type},
          body:file
        });
      }catch(networkError){
        networkError.status=0;
        throw networkError;
      }
      if(!upload.ok){
        var uploadError=new Error("r2_upload_failed_"+upload.status);
        uploadError.status=upload.status;
        throw uploadError;
      }

      return{
        key:signed.key,
        url:signed.read_url||signed.public_url,
        publicUrl:signed.public_url||"",
        readUrl:signed.read_url||"",
        name:file.name,
        contentType:file.type,
        size:file.size,
        kind:kind,
        uploadedAt:new Date().toISOString(),
        _fingerprint:[file.name,file.size,file.type,file.lastModified||0].join("|")
      };
    };
    return true;
  }

  [0,40,120,300,800].forEach(function(delay){setTimeout(install,delay)});
  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(install,0);
  });
})();