#ifndef _LDACBT_H_
#define _LDACBT_H_

#ifdef __cplusplus
extern "C" {
#endif

// LDAC Handle Type
typedef struct _ldacbt_handle * HANDLE_LDAC_BT;

// Error Codes
#define LDACBT_ERR_NONE              0
#define LDACBT_ERR_NON_FATAL         1
#define LDACBT_ERR_FATAL             2
#define LDACBT_ERR_ILL_PARAM         3
#define LDACBT_ERR_ILL_VERSION       4

// Sampling frequencies
#define LDACBT_SMPL_FMT_S16          0x1
#define LDACBT_SMPL_FMT_S24          0x2
#define LDACBT_SMPL_FMT_S32          0x3
#define LDACBT_SMPL_FMT_F32          0x4

// Channel Modes
#define LDACBT_CHANNEL_MODE_STEREO   0x00
#define LDACBT_CHANNEL_MODE_DUAL_CHANNEL 0x01
#define LDACBT_CHANNEL_MODE_MONO     0x02

// Quality Modes
#define LDACBT_EQMID_HQ              0
#define LDACBT_EQMID_SQ              1
#define LDACBT_EQMID_MQ              2

// API Functions
HANDLE_LDAC_BT ldacBT_get_handle(void);
void ldacBT_free_handle(HANDLE_LDAC_BT hLdacBt);
int ldacBT_init_handle_encode(HANDLE_LDAC_BT hLdacBt, int mtu, int eqmid, int channel_mode, int fmt, int sampling_freq);
int ldacBT_encode(HANDLE_LDAC_BT hLdacBt, void *p_pcm, int *pcm_used, unsigned char *p_stream, int *stream_sz, int *frame_num);
int ldacBT_get_error_code(HANDLE_LDAC_BT hLdacBt);
int ldacBT_get_sampling_freq(HANDLE_LDAC_BT hLdacBt);
int ldacBT_get_bitrate(HANDLE_LDAC_BT hLdacBt);

#ifdef __cplusplus
}
#endif

#endif /* _LDACBT_H_ */
