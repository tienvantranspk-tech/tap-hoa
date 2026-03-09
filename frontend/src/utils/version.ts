const formatBuildTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleString("vi-VN");
};

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || __APP_VERSION__;
export const APP_BUILD_TIME = formatBuildTime(__BUILD_TIME__);
