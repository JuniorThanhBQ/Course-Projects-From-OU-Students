function HuyLich(scheduleId) {
    fetch(`/HuyLich/${scheduleId}`, {
        method: "delete",
    })
    .then(res => {
        if (res.ok) {
            window.location.href = "/XemLich/0";
        } else {
            alert("Không thể hủy lịch trong các trường hợp đặt lịch giúp hoặc không có quyền xóa lịch");
        }
    })
    .catch(err => console.error("Lỗi fetch:", err));
}