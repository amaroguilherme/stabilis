import pytest

from api.jobs import JobStore, JobWorker, QueueFull


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class ReadyRuntime:
    engine = object()

    def ensure_ready(self) -> bool:
        return True


class UnavailableRuntime:
    engine = None

    def ensure_ready(self) -> bool:
        return False


def _worker(store, handler=lambda engine, payload: {"echo": payload["x"]}, runtime=None):
    return JobWorker(store, {"kind": handler}, runtime or ReadyRuntime())


def test_queue_is_bounded():
    store = JobStore(max_queued=2)
    store.submit("kind", {})
    store.submit("kind", {})
    with pytest.raises(QueueFull):
        store.submit("kind", {})


def test_positions_follow_fifo_order():
    store = JobStore()
    first, second = store.submit("kind", {}), store.submit("kind", {})
    assert (store.position(first.id), store.position(second.id)) == (1, 2)
    assert store.next_job(timeout=0).id == first.id
    assert store.position(second.id) == 1


def test_worker_runs_the_handler_and_drops_the_payload():
    store = JobStore()
    job = store.submit("kind", {"x": 42})
    assert _worker(store).run_once() is True
    assert job.status == "done"
    assert job.result == {"echo": 42}
    assert job.payload is None


def test_handler_errors_become_a_generic_code():
    def boom(engine, payload):
        raise ValueError("texto do paciente que não pode vazar")

    store = JobStore()
    job = store.submit("kind", {"x": 1})
    _worker(store, handler=boom).run_once()
    assert (job.status, job.error) == ("error", "internal")


def test_unavailable_engine_fails_with_model_unavailable():
    store = JobStore()
    job = store.submit("kind", {"x": 1})
    _worker(store, runtime=UnavailableRuntime()).run_once()
    assert (job.status, job.error) == ("error", "model_unavailable")


def test_run_once_returns_false_when_idle():
    assert _worker(JobStore()).run_once(timeout=0) is False


def test_finished_results_expire_after_ttl():
    clock = FakeClock()
    store = JobStore(ttl_s=600, clock=clock)
    job = store.submit("kind", {"x": 1})
    _worker(store).run_once()
    clock.now = 599
    assert store.get(job.id) is not None
    clock.now = 1200
    assert store.get(job.id) is None


def test_abandoned_queued_jobs_expire_and_free_the_queue():
    clock = FakeClock()
    store = JobStore(max_queued=1, ttl_s=600, clock=clock)
    store.submit("kind", {})
    clock.now = 601
    store.submit("kind", {})  # the stale job no longer counts against the limit
    assert store.queued_count() == 1


def test_deleting_a_queued_job_removes_it_from_the_queue():
    store = JobStore()
    job = store.submit("kind", {"x": 1})
    assert store.delete(job.id) is True
    assert store.queued_count() == 0
    assert store.delete(job.id) is False


def test_deleting_a_running_job_drops_its_result():
    store = JobStore()
    job = store.submit("kind", {"x": 1})
    running = store.next_job(timeout=0)
    store.delete(job.id)
    store.finish(running, result={"secret": True})
    assert running.result is None
    assert store.get(job.id) is None
