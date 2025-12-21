#include <napi.h>
#include "ldacBT.h"

class LdacEncoder : public Napi::ObjectWrap<LdacEncoder> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  LdacEncoder(const Napi::CallbackInfo& info);
  ~LdacEncoder();

 private:
  static Napi::FunctionReference constructor;
  HANDLE_LDAC_BT handle;

  Napi::Value Encode(const Napi::CallbackInfo& info);
  Napi::Value GetBitrate(const Napi::CallbackInfo& info);
};

Napi::FunctionReference LdacEncoder::constructor;

Napi::Object LdacEncoder::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "LdacEncoder", {
    InstanceMethod("encode", &LdacEncoder::Encode),
    InstanceMethod("getBitrate", &LdacEncoder::GetBitrate),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("LdacEncoder", func);
  return exports;
}

LdacEncoder::LdacEncoder(const Napi::CallbackInfo& info) : Napi::ObjectWrap<LdacEncoder>(info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return;
  }

  int mtu = info[0].As<Napi::Number>().Int32Value();
  int eqmid = info[1].As<Napi::Number>().Int32Value();
  int channel_mode = info[2].As<Napi::Number>().Int32Value();
  int fmt = info[3].As<Napi::Number>().Int32Value();
  int sampling_freq = info[4].As<Napi::Number>().Int32Value();

  this->handle = ldacBT_get_handle();
  if (this->handle) {
    ldacBT_init_handle_encode(this->handle, mtu, eqmid, channel_mode, fmt, sampling_freq);
  } else {
     Napi::Error::New(env, "Failed to create LDAC handle").ThrowAsJavaScriptException();
  }
}

LdacEncoder::~LdacEncoder() {
    if (this->handle) {
        ldacBT_free_handle(this->handle);
        this->handle = NULL;
    }
}

Napi::Value LdacEncoder::Encode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Buffer<char> inputBuffer = info[0].As<Napi::Buffer<char>>();
    size_t inputLen = inputBuffer.Length();
    char* inputData = inputBuffer.Data();
    
    int pcm_used = 0;
    unsigned char stream[1024]; // Approx output buffer
    int stream_sz = 1024;
    int frame_num = 0;
    
    int res = ldacBT_encode(this->handle, (void*)inputData, &pcm_used, stream, &stream_sz, &frame_num);
    
    if (res != 0) {
        // Handle error or need more data
        return Napi::Buffer<char>::New(env, 0); 
    }
    
    return Napi::Buffer<char>::Copy(env, (char*)stream, stream_sz);
}

Napi::Value LdacEncoder::GetBitrate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    int bitrate = ldacBT_get_bitrate(this->handle);
    return Napi::Number::New(env, bitrate);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return LdacEncoder::Init(env, exports);
}

NODE_API_MODULE(ldac_native, Init)
