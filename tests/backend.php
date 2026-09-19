<?php
// Runs the actual plugin logic against a transactional in-memory SQLite adapter.
// Production uses InnoDB row locks; this suite covers transitions and rollback of failed writes.
namespace Elementor { class Plugin { public static $instance; } }
namespace Elementor\Core\Files\CSS { class Post { public static function create($id) { return new self; } public function update() {} } }
namespace {
define('ABSPATH',__DIR__.'/'); define('ARRAY_A','ARRAY_A');
function register_activation_hook(...$args) {} function add_action(...$args) {} function do_action(...$args) {}
function get_current_user_id() { return 1; } function current_user_can(...$args) { return true; }
function get_post($id) { global $wpdb; $p=$wpdb->get_row("SELECT * FROM wp_posts WHERE ID=".(int)$id,ARRAY_A); return $p?(object)$p:null; }
function did_action($x) { return true; } function get_permalink($id) { return 'https://road-to-p1.com/page/'.$id; }
function wp_json_encode($x,$flags=0) { return json_encode($x,$flags); }
function wp_strip_all_tags($s) { return strip_tags($s); } function sanitize_text_field($s) { return strip_tags($s); }
function wp_generate_uuid4() { return vsprintf('%s%s-%s-%s-%s-%s%s%s',str_split(bin2hex(random_bytes(16)),4)); }
function current_time($type,$gmt=false) { return '2026-09-19 16:30:00'; }
function clean_post_cache($id) {} function wp_cache_delete(...$args) {} function delete_post_meta(...$args) {}
class Request implements \ArrayAccess {
    public function __construct(public array $data) {} public function get_json_params() { return $this->data; }
    public function offsetExists(mixed $o): bool { return isset($this->data[$o]); }
    public function offsetGet(mixed $o): mixed { return $this->data[$o]??null; }
    public function offsetSet(mixed $o,mixed $v):void { $this->data[$o]=$v; }
    public function offsetUnset(mixed $o):void { unset($this->data[$o]); }
}
class DB {
    public $prefix='wp_', $posts='wp_posts', $postmeta='wp_postmeta', $options='wp_options', $failReceipt=false;
    public SQLite3 $db;
    public function __construct() {
        $this->db=new SQLite3(':memory:'); $this->db->enableExceptions(true);
        $this->db->exec('CREATE TABLE wp_posts (ID INTEGER PRIMARY KEY, post_type TEXT,post_title TEXT,post_content TEXT,post_excerpt TEXT,post_status TEXT,post_name TEXT,post_modified TEXT,post_modified_gmt TEXT)');
        $this->db->exec('CREATE TABLE wp_postmeta (meta_id INTEGER PRIMARY KEY,post_id INTEGER,meta_key TEXT,meta_value TEXT)');
        $this->db->exec("CREATE TABLE wp_rtp1_media_drafts (id TEXT PRIMARY KEY,page_id INTEGER,owner_id INTEGER,state TEXT,payload TEXT,receipt TEXT,review_hash TEXT DEFAULT '',created_at INTEGER,expires_at INTEGER)");
    }
    public function prepare($sql,...$args) { $i=0;return preg_replace_callback('/%[ds]/',function($m)use($args,&$i){$v=$args[$i++];return $m[0]==='%d'?(string)(int)$v:"'".SQLite3::escapeString($v)."'";},$sql); }
    private function normalize($sql) { return str_replace([' FOR UPDATE','BINARY ','START TRANSACTION'],['','','BEGIN TRANSACTION'],$sql); }
    public function query($sql) { $this->db->exec($this->normalize($sql));return $this->db->changes(); }
    public function get_results($sql,$mode=null) { $r=$this->db->query($this->normalize($sql));$rows=[];while($row=$r->fetchArray(SQLITE3_ASSOC))$rows[]=$row;return $rows; }
    public function get_row($sql,$mode=null) {return $this->get_results($sql)[0]??null;}
    public function get_var($sql) { if(str_contains($sql,'information_schema')) return 'InnoDB';$row=$this->get_row($sql);return $row?array_values($row)[0]:null; }
    public function insert($table,$data) {return $this->query('INSERT INTO '.$table.' ('.implode(',',array_keys($data)).') VALUES ('.implode(',',array_map(fn($v)=>"'".SQLite3::escapeString((string)$v)."'",array_values($data))).')');}
    public function update($table,$data,$where) {
        if($this->failReceipt && $table==='wp_rtp1_media_drafts' && isset($data['receipt'])) return false;
        $pairs=fn($a)=>array_map(fn($k)=>$k."='".SQLite3::escapeString((string)$a[$k])."'",array_keys($a));
        return $this->query('UPDATE '.$table.' SET '.implode(',',$pairs($data)).' WHERE '.implode(' AND ',$pairs($where)));
    }
}
\Elementor\Plugin::$instance=(object)['elements_manager'=>new class {
    public function create_element_instance($node) { return new class {
        public function get_title(){return 'Hero';}
        public function get_controls(){return ['min_height_mobile'=>['type'=>'slider','size_units'=>['px','vh'],'range'=>['vh'=>['min'=>0,'max'=>100]]],'min_height'=>['type'=>'slider','size_units'=>['px','vh']],'custom_css'=>['type'=>'text'],'title'=>['type'=>'text']];}
    }; }
}];
require __DIR__.'/../wordpress/rtp1-media/rtp1-media.php';
function ok($condition,$text) {if(!$condition)throw new \Exception($text);echo "PASS $text\n";}
function rejects($callback,$code,$text) {try{$callback();}catch(\Throwable $e){ok($e->getCode()===$code,$text.' ('.$e->getCode().')');return;}throw new \Exception('Expected rejection: '.$text);}
function reset_db() {
    global $wpdb;$wpdb=new DB;
    $wpdb->insert('wp_posts',['ID'=>10,'post_type'=>'page','post_title'=>'Accueil','post_content'=>'original','post_excerpt'=>'','post_status'=>'publish','post_name'=>'accueil','post_modified'=>'2026-09-19 10:00:00','post_modified_gmt'=>'2026-09-19 08:00:00']);
    $data=[['id'=>'8480ea5','elType'=>'container','settings'=>['min_height'=>['size'=>100,'unit'=>'vh'],'background_image'=>['id'=>42]],'elements'=>[['id'=>'html1','elType'=>'widget','widgetType'=>'html','settings'=>['html'=>'<style>.intro{color:red}</style><p class="intro">Bonjour</p>'],'elements'=>[]]]]];
    $wpdb->insert('wp_postmeta',['meta_id'=>1,'post_id'=>10,'meta_key'=>'_elementor_data','meta_value'=>json_encode($data)]);
    $wpdb->insert('wp_postmeta',['meta_id'=>2,'post_id'=>10,'meta_key'=>'_elementor_page_settings','meta_value'=>'a:0:{}']);
}
function raw_data() {global $wpdb;return $wpdb->get_var("SELECT meta_value FROM wp_postmeta WHERE meta_id=1");}
function make_draft($changes=null,$scope='mobile') {
    $snapshot=RTP1_Media::snapshot_route(new Request(['id'=>10]));
    $changes ??= [['kind'=>'setting','elementId'=>'8480ea5','key'=>'min_height_mobile','selector'=>'','device'=>'mobile','value'=>'{"unit":"vh","size":55}','reason'=>'Réduire']];
    return RTP1_Media::draft(new Request(['pageId'=>10,'instruction'=>'Réduire la hauteur','device'=>$scope,'revision'=>$snapshot['revision'],'summary'=>'Test','changes'=>$changes]))['draft'];
}
function approve($id) {global $wpdb;$wpdb->update('wp_rtp1_media_drafts',['review_hash'=>'reviewed'],['id'=>$id]);return new Request(['draftId'=>$id,'reviewHash'=>'reviewed','confirm'=>true]);}

reset_db();$original=raw_data();$d=make_draft();ok(raw_data()===$original,'draft never modifies page data');
rejects(fn()=>RTP1_Media::apply(new Request(['draftId'=>$d['id'],'confirm'=>false])),400,'explicit confirmation required');
rejects(fn()=>RTP1_Media::apply(new Request(['draftId'=>$d['id'],'confirm'=>true,'reviewHash'=>'forged'])),409,'preview receipt required');
$r=approve($d['id']);$result=RTP1_Media::apply($r);$written=raw_data();
ok($result['draft']['status']==='applied','validated draft applied');
$data=json_decode($written,true);ok($data[0]['settings']['min_height']['size']===100 && $data[0]['settings']['min_height_mobile']['size']===55 && $data[0]['settings']['background_image']['id']===42,'mobile-only patch preserves other settings');
ok(RTP1_Media::apply($r)['idempotent']===true && raw_data()===$written,'duplicate apply is idempotent');
RTP1_Media::rollback($r);ok(raw_data()===$original,'rollback restores original bytes');
ok(RTP1_Media::rollback($r)['idempotent']===true,'duplicate rollback is idempotent');

reset_db();$d=make_draft();$r=approve($d['id']);$wpdb->update('wp_posts',['post_content'=>'external edit'],['ID'=>10]);
rejects(fn()=>RTP1_Media::apply($r),409,'content change after draft is blocked');
reset_db();$d=make_draft();$r=approve($d['id']);$wpdb->update('wp_postmeta',['meta_value'=>'changed settings'],['meta_id'=>2]);
rejects(fn()=>RTP1_Media::apply($r),409,'Elementor page settings change is blocked');
reset_db();$d=make_draft();$r=approve($d['id']);RTP1_Media::apply($r);$wpdb->update('wp_posts',['post_content'=>'later edit'],['ID'=>10]);
rejects(fn()=>RTP1_Media::rollback($r),409,'rollback cannot overwrite a later change');
reset_db();$d=make_draft();$r=approve($d['id']);$wpdb->update('wp_rtp1_media_drafts',['expires_at'=>time()-1],['id'=>$d['id']]);
rejects(fn()=>RTP1_Media::apply($r),410,'expired draft cannot publish');
reset_db();$d=make_draft();$r=approve($d['id']);RTP1_Media::reject($r);
rejects(fn()=>RTP1_Media::apply($r),409,'rejected draft cannot publish');
reset_db();$d=make_draft();$r=approve($d['id']);$original=raw_data();$wpdb->failReceipt=true;
rejects(fn()=>RTP1_Media::apply($r),503,'backup receipt failure aborts transaction');
ok(raw_data()===$original,'failed transaction leaves original page intact');
$wpdb->failReceipt=false;ok(RTP1_Media::read_draft(new Request(['id'=>$d['id']]))['draft']['status']==='pending','failed transaction leaves draft pending');

reset_db();$change=['kind'=>'setting','elementId'=>'8480ea5','key'=>'custom_css','selector'=>'','device'=>'all','value'=>'"malicious"','reason'=>'test'];
rejects(fn()=>make_draft([$change],'all'),422,'arbitrary code controls rejected');
$change['key']='min_height';$change['value']='{"unit":"vh","size":50}';
rejects(fn()=>make_draft([$change],'mobile'),422,'mobile request cannot change desktop defaults');
$change=['kind'=>'html_style','elementId'=>'html1','key'=>'padding-top','selector'=>'.intro','device'=>'mobile','value'=>'12px','reason'=>'Réduire'];
$d=make_draft([$change]);$r=approve($d['id']);RTP1_Media::apply($r);
ok(str_contains(raw_data(),'max-width:767px') && str_contains(raw_data(),'padding-top:12px!important'),'HTML styles are scoped to the requested device');
reset_db();$change['value']='url(https://evil.invalid)';rejects(fn()=>make_draft([$change]),422,'CSS URLs cannot be injected');
$change=['kind'=>'html_text','elementId'=>'html1','key'=>'Bonjour','selector'=>'','device'=>'all','value'=>'Bienvenue & merci','reason'=>'Texte'];
$d=make_draft([$change],'all');RTP1_Media::apply(approve($d['id']));
ok(str_contains(json_decode(raw_data(),true)[0]['elements'][0]['settings']['html'],'Bienvenue &amp; merci'),'HTML text is escaped without changing styles');
echo "Backend checks completed.\n";
}
