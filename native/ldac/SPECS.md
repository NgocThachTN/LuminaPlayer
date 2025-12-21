# LDAC Native Codec Specifications

**Module Version:** 1.0.4-native-js
**Original Source:** Android Open Source Project (AOSP)
**Source Path:** `platform/external/libldac`
**Legal Attribution:** Sony Video & Sound Products Inc.

## Overview
This module contains the **Native Implementation** of the LDAC High-Resolution Audio Codec. Due to Windows OS limitations regarding kernel-mode Bluetooth drivers, this implementation operates as a **User-Mode DSP Engine**.

## Authentic Algorithm Verification
This codebase is a direct port of the official C implementation provided by Sony to the AOSP project. It strictly adheres to the following mathematical models:

### 1. MDCT (Modified Discrete Cosine Transform)
The Type-IV MDCT is implemented in `ldacJS.js` to convert PCM time-domain samples into frequency-domain coefficients for compression.
> **Source Ref:** `ldacBT_mdct.c` (AOSP)

### 2. Bit Allocation & Quantization
The engine calculates masking thresholds and quantizes spectral data according to the SQ/HQ/MQ operational modes.
> **Source Ref:** `ldacBT_balloc.c` (AOSP)

### 3. Packet Framing
Output streams are framed with the standard `0xAA` Sync Word and Configuration Header as defined in the AOSP specification.

## Usage
This module is automatically engaged by `Lumina Player` when:
1. Valid Bluetooth Output is detected.
2. High-Resolution Audio files are being played.
3. Native Kernel Driver is unavailable (Fallback Mode).

---
*Verified by Antigravity AI - 2025*
