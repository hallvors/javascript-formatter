<?php
/* enable command line usage */
$source_file = ( isset( $argv[1])  && is_file( $argv[1])  ) ? $argv[1] : '';

/* defining the various scopes we care about for this excercise */
define( 'CODE', 0 ); /* normal JS code */
define( 'STRING_DBL', 1 ); /* double quoted string */
define( 'STRING_SGL', 2 ); /* single quoted string */
define( 'REGEXP', 3 ); /* regexp literal */
define( 'ESCAPE', 4 ); /* some escape char (backslash) */
define ( 'MULTI_LINE_COMMENT', 5 );
define ( 'SINGLE_LINE_COMMENT', 6 );
define ( 'REGEXP_CHAR_CLASS', 7 ); /* inside a [ ... ] clause in a regular expression. Requires its own scope because /[/]/ is a valid regexp */
$debug=false;
$start = time();
$url = isset( $_GET['url'] ) ? $_GET['url'] : '';

if( empty(  $url  )  && empty( $source_file ) ){

	if(isset( $_POST['code'] )){
		$code = $_POST[ 'code' ];
		if(  get_magic_quotes_gpc ( )  ){ $code = stripslashes(  $code  ) ; }  /* repeat after me: magic quotes is a bad, bad idea */
		if( $_REQUEST['code_is_base64_encoded'] ){
			$code = base64_decode( $code );
		}
	}else{
		header( 'Content-type: text/html; charset=utf-8' );
		echo( '<!DOCTYPE html><html><head><title>basic code formatter</title></head><body><form>URL: <input type="url" name="url"><input type="submit"></form><p>or...</p><form method="post">Code: <textarea name="code" rows="15" style="width:100%"></textarea><br><input type="submit"> <label><input type="checkbox" name="code_is_base64_encoded">Input is Base64-encoded</label></form></body></html>' ); exit; /* - very important to keep all that on one line to increase appreciation of irony -  */
	}
}else{

	$code = $url ? file_get_contents(  $url ) : file_get_contents($source_file);

}

header( 'Content-type: text/plain; charset=utf-8' ); /* best content type for code inspection cross-browser :-p */

// echo ( ' loaded stuff in ' . (time() - $start) . "ms\n");

if(  empty( $code )  ){echo( 'could not retrieve '.$url ); exit;}

$output=''; /* would array perform better as in JS? */
$num_indents = 0;
$character_index = 0;
$char='';

$scope = CODE;
$before_escape_scope=0;
$at_start_of_statement_or_expression=true; /* used to distinguish divisor from regexp literal */
$last_complete_word = ''; /* some rudimentary tokenisation is required for the divisor-or-regexp problem */
$statement_words = array('return', 'typeof', 'instanceof', 'break', 'continue', 'delete', 'in', 'new', 'throw');

while( $character_index < strlen(  $code  ) ){
	$char = substr( $code, $character_index, 1 );
	if($debug)echo ( (time() - $start). "ms elapsed, now on $character_index / ".strlen($code)." $char, mode: $scope, last word: '$last_complete_word' - start of expression? $at_start_of_statement_or_expression \n");
	$pre = ''; /* add this string *before* this character when constructing output */
	$post = ''; /* add this string *after* this character when constructing output */
	switch( $char ){
		case '"': /* double quote */
			switch( $scope ){
				case STRING_DBL:
					$scope=CODE ; break; /* a non-escaped quote inside string terminates string */
				case ESCAPE:
					$scope = $before_escape_scope; break; /* the quote was escaped, return to previous scope */
				case CODE:
					$scope = STRING_DBL ; /* start-of-string double quote */
					$at_start_of_statement_or_expression=false;
			}
			break;
		case '\'': /* single quote */
			switch( $scope ){
				case STRING_SGL:
					$scope=CODE ; break; /* a non-escaped quote inside string terminates string */
				case ESCAPE:
					$scope = $before_escape_scope; break; /* the quote was escaped, return to previous scope */
				case CODE:
					$scope = STRING_SGL ;  /* start-of-string single quote */
					$at_start_of_statement_or_expression=false;
			}
			break;
		case '\\':
			if( $scope == STRING_DBL || $scope == STRING_SGL || $scope == REGEXP || $scope == REGEXP_CHAR_CLASS){
				$before_escape_scope = $scope ;
				$scope = ESCAPE ; /* next character not to be taken seriously (well..) */
			}else if( $scope == ESCAPE ){ /* handle escaped backslashes "\\" */
				$scope = $before_escape_scope ;
			}
			break;
		case '/':
			if( $scope == CODE ){ /* lookahead: start of comment or something else? */
				$tmp = substr( $code, $character_index+1, 1 );
				if( $tmp == '*' ){ /* start of multi-line comment */
					$scope = MULTI_LINE_COMMENT ;
				}else if( $tmp == '/' ){ /* start of single-line comment */
					$scope = SINGLE_LINE_COMMENT ;
				}else if( $at_start_of_statement_or_expression || in_array( $last_complete_word, $statement_words ) ){ /* start of regexp */
					$scope = REGEXP ;
				}
			}else if( $scope == ESCAPE ){
				$scope = $before_escape_scope ;
			}else if( $scope == REGEXP ){
				$scope = CODE ;
			}else if( $scope == MULTI_LINE_COMMENT ){ /* time to leave the comment?? */
				$tmp = substr( $code, $character_index - 1, 1 );
				if( $tmp == '*' ) $scope = CODE ; /* we only enter multi-line-comment mode from CODE scope AFAIK */
			}
			break;
		case '{':
			if(  $scope == CODE ){ /* start-of-block curly brace */
				/* Sigbj�rn special: do not wrap and indent empty blocks (object literal) */
				if( lookahead( $code, $character_index, true )=='}' ){ /* we have an object literal. We'll simply add a closing brace and jump ahead */
					$character_index=strpos( $code, '}', $character_index );
					$post='}';
					break;
				}
				$num_indents ++ ;
				$post = "\n";
				$post .= str_repeat(  "\t", $num_indents  );
				$at_start_of_statement_or_expression = true;
			}else if( $scope == ESCAPE ){
				$scope = $before_escape_scope ;
			}
			break;
		case '}':
			if(  $scope == CODE ){ /* end-of-block curly brace */
				if(  $num_indents>0  )$num_indents -- ;
				$pre = "\n";
				$pre .= str_repeat(  "\t", $num_indents  );
				$post = "\n" . str_repeat(  "\t", $num_indents ) ;
			}else if( $scope == ESCAPE ){
				$scope = $before_escape_scope ;
			}
			break;
		case ';':
//		case ',':
			if(  $scope == CODE ){ /* end-of-statement semicolon //, or between-variables comma */
				$post = "\n";
				$post .= str_repeat(  "\t", $num_indents  );
				$at_start_of_statement_or_expression = true;
			}else if( $scope == ESCAPE ){
				$scope = $before_escape_scope ;
			}
			break;
		case "\n":
			if( $scope == SINGLE_LINE_COMMENT ){
				$scope = CODE; /* we only enter SINGLE_LINE_COMMENT mode from CODE, right?  */
			}else if( $scope == ESCAPE ){
				$scope = $before_escape_scope ;
			} /* no break, we want to get to the $at_start_of_statement_or_expression bit below */
		case '(':
		case '!':
		case '=':
		case '-':
		case '+':
		case '?':
		case '*':
		case '&':
		case ':':
		case ',':
		case '|':
			if( $scope == CODE ){
				$at_start_of_statement_or_expression=true; /* at start of parens, after equal sign etc.. if the next char is a forward slash it will be a start-of-regexp, not a divisor */
			}else if( $scope == ESCAPE ){
				$scope = $before_escape_scope ;
			}
			break;
		case '[':
			if( $scope == REGEXP ){
				$scope=REGEXP_CHAR_CLASS;
				$at_start_of_statement_or_expression=false;
			}else if( $scope == ESCAPE ){
				$scope = $before_escape_scope ;
			}
			break;
		case ']':
			if( $scope == REGEXP_CHAR_CLASS ){
				$scope=REGEXP;
				$at_start_of_statement_or_expression=false;
			}else if( $scope == ESCAPE ){
				$scope = $before_escape_scope ;
			}
			break;
		default:
			if( $scope == ESCAPE ){
				$scope = $before_escape_scope ; /* always drop out of escape mode on next character..  yes, multi-char escapes exist but it's OK to treat the rest of it as part of the string */
			}
			if( $scope == CODE ){ /* reset at_start_of_statement_or_expression flag (but ignore whitespace!) */
				if( !( $char==' ' || $char=="\t" ) ) $at_start_of_statement_or_expression = false;
			}
			break;
	}
	if( preg_match('/[a-zA-Z0-9]/', $char) ){
		/* if the previous character was whitespace or punctuation, this starts a new word.. */
		if( ! preg_match('/[a-zA-Z0-9]/', substr( $code, $character_index - 1, 1 )) ){
			$last_complete_word='';
		}
		$last_complete_word .= $char;
	}
//	if( $scope == CODE &&  ( $char == "\t" || $char == "\n" ) ){ /* this script will add formatting whitespace */ // proven too fragile..
//
//	}else{
		$output .= $pre . $char . $post ;
//	}
	$character_index++;
}
$output = preg_replace( '/\n\s*\n/', "\n", $output );
if($source_file){
	$f=fopen($source_file, 'w');
	fwrite($f, $output);
	fclose($f);
}else{
	echo $output;
}
function lookahead($str, $index, $ignore_whitespace=false){ /* returns next character, potentially ignoring whitespace */
	$char = substr( $str, $index+1, 1 );
	while(  $ignore_whitespace && $index<count( $str ) && trim($char)=='' ){
		$index++;
		$char = substr( $str, $index+1, 1 );
	}
	return $char ? $char : ''; /* if we've gone past end of string, substr() returns false - we'd rather return '' */
}
?>
